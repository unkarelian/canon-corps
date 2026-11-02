// Canon Corps test-build launcher (macOS, Windows, Linux).
//
// A Go port of game/server.py: serves the embedded game on localhost, proxies
// LLM calls to OpenRouter with the player's own key (BYOK), and opens a window.
// The key is asked for on first launch and kept in
// config.json in the per-user data dir (see platform.go). It never reaches the page.
package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed all:web
var webFS embed.FS

var port = envInt("CC_PORT", 8077) // fixed so localStorage (played worlds, notes) survives between launches

const (
	upstream = "https://openrouter.ai/api/v1/chat/completions"
	idleQuit = 6 * time.Minute // with no window process to watch, quit after this long without a heartbeat
)

var (
	dataDir  string
	worlds   string
	runs     string
	lastSeen atomic.Int64
	client   = &http.Client{Timeout: 10 * time.Minute}
)

type config struct {
	Key string `json:"openrouter_api_key"`
}

func envInt(k string, d int) int {
	var n int
	if _, err := fmt.Sscan(os.Getenv(k), &n); err == nil && n > 0 {
		return n
	}
	return d
}

func cfgPath() string { return filepath.Join(dataDir, "config.json") }

func loadKey() string {
	if k := os.Getenv("OPENROUTER_API_KEY"); k != "" {
		return k
	}
	var c config
	if b, err := os.ReadFile(cfgPath()); err == nil {
		_ = json.Unmarshal(b, &c)
	}
	return c.Key
}

func saveKey(k string) error {
	b, _ := json.MarshalIndent(config{Key: k}, "", " ")
	return os.WriteFile(cfgPath(), b, 0o600)
}

func main() {
	for ext, t := range map[string]string{".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
		".webm": "video/webm", ".ogg": "audio/ogg", ".wav": "audio/wav", ".png": "image/png", ".css": "text/css"} {
		_ = mime.AddExtensionType(ext, t)
	}
	dataDir = dataDirFor()
	worlds = filepath.Join(dataDir, "worlds")
	runs = filepath.Join(dataDir, "runs")
	for _, d := range []string{dataDir, runs} {
		_ = os.MkdirAll(d, 0o755)
	}
	if lf, err := os.OpenFile(filepath.Join(dataDir, "log.txt"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); err == nil {
		log.SetOutput(io.MultiWriter(os.Stderr, lf))
	}
	seedWorlds()

	url := fmt.Sprintf("http://localhost:%d/", port)
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil { // already running: just bring up another window
		log.Printf("port %d busy (%v); opening window on the running copy", port, err)
		openWindow(url, false)
		return
	}
	lastSeen.Store(time.Now().Unix())
	srv := &http.Server{Handler: routes()}
	go func() { log.Fatal(srv.Serve(ln)) }()
	log.Printf("Canon Corps on %s", url)

	if os.Getenv("CC_NOWINDOW") != "" { // headless, for testing builds
		select {}
	}
	if openWindow(url, true) { // blocked until the app window closed
		log.Print("window closed; quitting")
		return
	}
	for { // opened in the default browser: quit once the page stops calling in
		time.Sleep(30 * time.Second)
		if time.Since(time.Unix(lastSeen.Load(), 0)) > idleQuit {
			log.Print("no heartbeat; quitting")
			return
		}
	}
}

// seedWorlds copies the shipped world pool into the writable data dir on first run.
func seedWorlds() {
	if _, err := os.Stat(worlds); err == nil {
		return
	}
	_ = os.MkdirAll(worlds, 0o755)
	entries, _ := fs.ReadDir(webFS, "web/worlds")
	for _, e := range entries {
		if b, err := webFS.ReadFile("web/worlds/" + e.Name()); err == nil {
			_ = os.WriteFile(filepath.Join(worlds, e.Name()), b, 0o644)
		}
	}
}

// openWindow prefers a Chromium-family browser in app mode with its own profile,
// which gives a plain game window and a process to wait on. Falls back to the
// default browser. Returns true if it waited for the window to close.
func openWindow(url string, wait bool) bool {
	for _, b := range browserCandidates() {
		if _, err := os.Stat(b); err != nil {
			continue
		}
		cmd := exec.Command(b, "--app="+url, "--user-data-dir="+filepath.Join(dataDir, "browser"),
			"--no-first-run", "--no-default-browser-check", "--window-size=1280,860")
		if err := cmd.Start(); err != nil {
			continue
		}
		log.Printf("opened %s", filepath.Base(b))
		if !wait {
			return true
		}
		_ = cmd.Wait()
		return true
	}
	openDefault(url)
	log.Print("opened default browser")
	return false
}

func routes() http.Handler {
	sub, _ := fs.Sub(webFS, "web")
	static := http.FileServer(http.FS(sub))
	mux := http.NewServeMux()

	mux.HandleFunc("/__alive", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	mux.HandleFunc("/setup", setupPage)

	mux.HandleFunc("/api/worlds", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost { // a world generated in the browser joins the pool
			var wd map[string]any
			body, _ := io.ReadAll(r.Body)
			if err := json.Unmarshal(body, &wd); err != nil {
				writeJSON(w, 400, map[string]any{"error": err.Error()})
				return
			}
			town := strings.ToLower(fmt.Sprint(wd["town"]))
			town = regexp.MustCompile(`[^\p{L}\p{N}]`).ReplaceAllString(town, "-")
			name := fmt.Sprintf("%v-%s.json", wd["id"], town)
			_ = os.WriteFile(filepath.Join(worlds, name), body, 0o644)
			writeJSON(w, 200, map[string]any{"saved": name})
			return
		}
		type item struct {
			File   string `json:"file"`
			ID     any    `json:"id"`
			Name   any    `json:"name"`
			Solved bool   `json:"solved"`
			mtime  time.Time
		}
		var items []item
		files, _ := filepath.Glob(filepath.Join(worlds, "*.json"))
		for _, f := range files {
			b, err := os.ReadFile(f)
			if err != nil {
				continue
			}
			var wd struct {
				ID        any `json:"id"`
				Name      any `json:"name"`
				Generated struct {
					Solver struct {
						Failures []any `json:"failures"`
					} `json:"solver"`
				} `json:"generated"`
			}
			if json.Unmarshal(b, &wd) != nil {
				continue
			}
			st, _ := os.Stat(f)
			items = append(items, item{filepath.Base(f), wd.ID, wd.Name, len(wd.Generated.Solver.Failures) == 0, st.ModTime()})
		}
		sort.SliceStable(items, func(i, j int) bool { return items[i].mtime.After(items[j].mtime) })
		if items == nil {
			items = []item{}
		}
		writeJSON(w, 200, map[string]any{"worlds": items})
	})

	mux.HandleFunc("/worlds/", func(w http.ResponseWriter, r *http.Request) {
		name := filepath.Base(r.URL.Path)
		http.ServeFile(w, r, filepath.Join(worlds, name))
	})

	mux.HandleFunc("/api/runlog", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		name := time.Now().Format("2006-01-02_150405") + ".json"
		_ = os.WriteFile(filepath.Join(runs, name), body, 0o644)
		writeJSON(w, 200, map[string]any{"saved": name})
	})

	mux.HandleFunc("/api/llm", func(w http.ResponseWriter, r *http.Request) {
		key := loadKey()
		if key == "" {
			writeJSON(w, 500, map[string]any{"error": fmt.Sprintf("No OpenRouter key set. Open http://localhost:%d/setup", port)})
			return
		}
		body, _ := io.ReadAll(r.Body)
		req, _ := http.NewRequest("POST", upstream, bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+key)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Title", "Canon Corps test build")
		resp, err := client.Do(req)
		if err != nil { // network trouble: the game treats it as a delivery delay
			writeJSON(w, 502, map[string]any{"error": err.Error()})
			return
		}
		defer resp.Body.Close()
		out, _ := io.ReadAll(resp.Body)
		if resp.StatusCode >= 300 {
			msg := string(out)
			if len(msg) > 500 {
				msg = msg[:500]
			}
			log.Printf("openrouter %d: %s", resp.StatusCode, msg)
			writeJSON(w, resp.StatusCode, map[string]any{"error": msg})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_, _ = w.Write(out)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			if loadKey() == "" {
				http.Redirect(w, r, "/setup", http.StatusFound)
				return
			}
			b, _ := webFS.ReadFile("web/index.html")
			// heartbeat, so the launcher knows when the game has been closed
			b = bytes.Replace(b, []byte("</body>"),
				[]byte(`<script>setInterval(()=>fetch("/__alive").catch(()=>{}),20000)</script></body>`), 1)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(b)
			return
		}
		static.ServeHTTP(w, r)
	})

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastSeen.Store(time.Now().Unix())
		w.Header().Set("Cache-Control", "no-store")
		mux.ServeHTTP(w, r)
	})
}

// checkKey asks OpenRouter whether the key is real before saving it.
func checkKey(k string) error {
	req, _ := http.NewRequest("GET", "https://openrouter.ai/api/v1/key", nil)
	req.Header.Set("Authorization", "Bearer "+k)
	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return fmt.Errorf("couldn't reach OpenRouter: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return fmt.Errorf("OpenRouter didn't accept that key")
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("OpenRouter answered %d", resp.StatusCode)
	}
	return nil
}

func setupPage(w http.ResponseWriter, r *http.Request) {
	msg := ""
	if r.Method == http.MethodPost {
		k := strings.TrimSpace(r.FormValue("key"))
		if k == "" {
			msg = "Paste a key first."
		} else if err := checkKey(k); err != nil {
			msg = err.Error()
		} else if err := saveKey(k); err != nil {
			msg = "Couldn't save the key: " + err.Error()
		} else {
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}
	}
	have := ""
	if k := loadKey(); k != "" && len(k) > 8 {
		have = fmt.Sprintf(`<p class="dim">A key is saved (…%s). Paste a new one to replace it, or <a href="/">go back to the game</a>.</p>`, html.EscapeString(k[len(k)-4:]))
	}
	errHTML := ""
	if msg != "" {
		errHTML = `<p class="err">` + html.EscapeString(msg) + `</p>`
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CanonOS - Connection</title>
<style>
body{background:#0b120b;color:#9fdc9f;font:15px/1.5 "Courier New",monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{border:1px solid #3f7a3f;padding:28px 34px;max-width:520px;background:#0f1a0f}
h1{font-size:17px;letter-spacing:.12em;margin:0 0 14px}
input{width:100%%;box-sizing:border-box;background:#050905;color:#c8f5c8;border:1px solid #3f7a3f;padding:8px;font:inherit}
button{margin-top:12px;background:#1d3a1d;color:#c8f5c8;border:1px solid #5aa05a;padding:6px 18px;font:inherit;cursor:pointer}
a{color:#c8f5c8}.dim{color:#6f9f6f;font-size:13px}.err{color:#f09a7a}
</style></head><body><form class="box" method="post" action="/setup">
<h1>CANONOS &middot; CONNECTION</h1>
<p>This build plays with your own <a href="https://openrouter.ai/keys" target="_blank">OpenRouter API key</a>. A run usually costs a few cents.</p>
<p class="dim">The key is stored only on this computer (%s) and is sent only to OpenRouter.</p>
%s%s
<input name="key" type="password" placeholder="sk-or-v1-..." autofocus autocomplete="off">
<button type="submit">Connect</button>
</form></body></html>`, html.EscapeString(cfgPath()), have, errHTML)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	b, _ := json.Marshal(v)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(b)
}
