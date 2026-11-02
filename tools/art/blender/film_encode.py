"""Encode rendered film frames (out/film/<shot>/000.png...) into game/assets/film/<shot>.webm at 12 fps.

Line-art shots (the opening cinematic: *_L and globe*) get a phosphor glow; shaded shots (the orientation
film) a little desaturation. Then both get played off a worn VHS tape: soft horizontal smear, colour bleed and
fringing, a slow line wobble, a tracking band that rolls down the picture, head-switching noise along the bottom,
tape noise and a faint brightness flicker. The CRT itself (scanlines, vignette) is drawn over the video in CSS,
since baked scanlines would not survive the encode.

  python3 tools/art/blender/film_encode.py [shot ...]
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "out/film"
DST = HERE.parents[2] / "game/assets/film"


# horizontal displacement per line: slow wobble + a tracking band rolling down + head-switching at the bottom
OFF = ("(1.4*sin(Y*0.045+T*1.9)"
       "+16*exp(-pow((Y-mod(T*70\\,900)+150)/9\\,2))*(0.6+0.4*sin(Y*1.7+T*60))"
       "+if(gt(Y\\,H-9)\\,22\\,0))")
VHS = (",scale=640:480:flags=bicubic,gblur=sigma=1.6:sigmaV=0.25"
       f",geq=r='r(X-{OFF}\\,Y)':g='g(X-{OFF}\\,Y)':b='b(X-{OFF}\\,Y)'"
       ",rgbashift=rh=-3:bh=3:edge=smear,format=yuv444p"
       ",boxblur=luma_radius=0:luma_power=0:chroma_radius=4:chroma_power=2"
       ",noise=alls=7:allf=t,eq=brightness=0.012*sin(t*23):eval=frame,format=yuv420p")


NO_TAPE = {"uplink_L"}  # shown live in the HQ Console, not played off a tape


def encode(d):
    lines = d.name.endswith("_L") or d.name.startswith("globe")
    tape = "" if d.name in NO_TAPE else VHS
    vf = ("format=gbrp,split[a][b];[b]gblur=sigma=3[g];[a][g]blend=all_mode=screen:all_opacity=0.9" if lines
          else "eq=saturation=0.85,format=gbrp") + (tape or ",format=yuv420p")
    out = DST / f"{d.name}.webm"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", "12", "-i", str(d / "%03d.png"), "-vf", vf,
                    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", "-an", str(out)], check=True)
    return out


if __name__ == "__main__":
    DST.mkdir(parents=True, exist_ok=True)
    names = sys.argv[1:] or sorted(p.name for p in SRC.iterdir() if p.is_dir())
    for n in names:
        o = encode(SRC / n)
        print(n, f"{o.stat().st_size // 1024} KB")
