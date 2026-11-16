import subprocess
from pathlib import Path


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def to_wav16k(source: Path, target: Path) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(target),
        ],
        capture_output=True,
        check=True,
    )
    return target


def split_wav(path: Path, seconds: int = 20) -> list[Path]:
    parts_dir = path.parent / f"{path.stem}_parts"
    parts_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(path),
            "-f",
            "segment",
            "-segment_time",
            str(seconds),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(parts_dir / "part_%03d.wav"),
        ],
        capture_output=True,
        check=True,
    )
    return sorted(parts_dir.glob("part_*.wav"))
