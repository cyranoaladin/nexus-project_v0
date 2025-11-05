import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import List

TEMPLATE = r"""
\documentclass[11pt]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{geometry}
\geometry{margin=2.2cm}

\title{Feuille d'exercices — {title}}
\author{{author}}
\date{}

\begin{document}
\maketitle

\section*{Exercices}
{body}

\end{document}
"""


def build_pdf(title: str, author: str, items: List[str], out_dir: str = "./data") -> str:
    """Construit un PDF LaTeX en utilisant `tectonic` (doit être disponible dans PATH)."""

    body = "\n\n".join([f"\\textbf{{Exercice {i + 1}.}}\\; {text}" for i, text in enumerate(items)])
    tex = TEMPLATE.format(title=title, author=author, body=body)

    tmp_dir = Path(tempfile.mkdtemp())
    tex_fp = tmp_dir / "sheet.tex"
    tex_fp.write_text(tex, encoding="utf-8")

    pdf_id = f"{uuid.uuid4().hex[:8]}_sheet.pdf"
    out_path = Path(out_dir) / pdf_id
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        subprocess.check_call(["tectonic", str(tex_fp)], cwd=tmp_dir)
        shutil.copyfile(tmp_dir / "sheet.pdf", out_path)
        return str(out_path)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
