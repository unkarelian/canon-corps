package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// dataDirFor is where the key, the world pool, run logs, the log file and the browser profile live.
func dataDirFor() string {
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "Canon Corps")
	case "windows":
		if d := os.Getenv("APPDATA"); d != "" {
			return filepath.Join(d, "Canon Corps")
		}
		return filepath.Join(home, "AppData", "Roaming", "Canon Corps")
	default:
		if d := os.Getenv("XDG_DATA_HOME"); d != "" {
			return filepath.Join(d, "canon-corps")
		}
		return filepath.Join(home, ".local", "share", "canon-corps")
	}
}

// browserCandidates lists Chromium-family browsers that can open the game as an app window.
func browserCandidates() []string {
	var out []string
	switch runtime.GOOS {
	case "darwin":
		home, _ := os.UserHomeDir()
		for _, b := range []string{
			"Google Chrome.app/Contents/MacOS/Google Chrome",
			"Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"Brave Browser.app/Contents/MacOS/Brave Browser",
			"Chromium.app/Contents/MacOS/Chromium",
		} {
			out = append(out, filepath.Join("/Applications", b), filepath.Join(home, "Applications", b))
		}
	case "windows":
		for _, root := range []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")} {
			if root == "" {
				continue
			}
			for _, b := range []string{
				`Google\Chrome\Application\chrome.exe`,
				`Microsoft\Edge\Application\msedge.exe`,
				`BraveSoftware\Brave-Browser\Application\brave.exe`,
			} {
				out = append(out, filepath.Join(root, b))
			}
		}
	default:
		for _, b := range []string{"google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
			"microsoft-edge", "microsoft-edge-stable", "brave-browser", "brave"} {
			if p, err := exec.LookPath(b); err == nil {
				out = append(out, p)
			}
		}
	}
	return out
}

func openDefault(url string) {
	switch runtime.GOOS {
	case "darwin":
		_ = exec.Command("open", url).Run()
	case "windows":
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	default:
		_ = exec.Command("xdg-open", url).Start()
	}
}
