import json
import glob
import os
from datetime import datetime
from pathlib import Path

PROJECT = Path(r"C:\Users\ユーザー\.claude\projects\C--Users------Desktop-ClaudeCode-2026-05-23")
OUT = Path(__file__).resolve().parents[1] / "session-history.md"


def first_user_message(path: Path) -> tuple[str, int]:
    first_user = ""
    msg_count = 0
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") != "user":
                continue
            msg_count += 1
            if first_user:
                continue
            content = obj.get("message", {}).get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    part.get("text", "")
                    for part in content
                    if isinstance(part, dict)
                )
            first_user = str(content).replace("\n", " ").strip()[:160]
    return first_user, msg_count


def main() -> None:
    rows = []
    for path in sorted(PROJECT.glob("*.jsonl"), key=lambda p: p.stat().st_mtime):
        mtime = datetime.fromtimestamp(path.stat().st_mtime)
        sid = path.stem
        preview, msg_count = first_user_message(path)
        rows.append((mtime, sid, msg_count, preview))

    lines = [
        "# Claude Code セッション履歴（将棋プロジェクト）",
        "",
        f"生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## 2026-05-23（昨日）",
        "",
        "| 時刻 | メッセージ数 | 最初の入力 | 再開コマンド |",
        "|------|-------------|-----------|-------------|",
    ]

    for mtime, sid, msg_count, preview in rows:
        if mtime.date().isoformat() != "2026-05-23":
            continue
        cmd = f"`claude --resume {sid}`"
        lines.append(
            f"| {mtime.strftime('%H:%M')} | {msg_count} | {preview or '(なし)'} | {cmd} |"
        )

    lines.extend(["", "## 全セッション", ""])
    for mtime, sid, msg_count, preview in rows:
        lines.append(f"### {mtime.strftime('%Y-%m-%d %H:%M')} — `{sid}`")
        lines.append(f"- メッセージ数: {msg_count}")
        lines.append(f"- 最初の入力: {preview or '(なし)'}")
        lines.append(f"- 再開: `claude --resume {sid}`")
        lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
