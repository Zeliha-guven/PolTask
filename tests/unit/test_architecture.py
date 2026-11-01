"""Mimari sınırlar (docs/architecture.md, Forbidden dependencies) — import analiziyle."""
import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "poltask"

FORBIDDEN = {
    "domain": {"poltask.storage", "poltask.integrations", "poltask.api", "flask", "sqlite3", "openpyxl"},
    "storage": {"poltask.api"},
    "integrations": {"poltask.api"},
}


def imported_modules(source, module):
    """Kaynaktaki tüm import'ların tam modül adları (göreli import'lar çözülür)."""
    names = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            names.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level:
                parts = module.split(".")[: -node.level]
                base = ".".join(parts + ([base] if base else []))
            names.add(base)
            names.update(f"{base}.{a.name}" for a in node.names)
    return names


def violations(source, module, forbidden):
    return sorted(n for n in imported_modules(source, module)
                  for f in forbidden if n == f or n.startswith(f + "."))


def package_files(name):
    files = sorted((PKG / name).rglob("*.py"))
    assert files, f"poltask/{name} boş — test hiçbir şeyi denetlemiyor"
    return files


def module_name(path):
    return ".".join(path.relative_to(ROOT).with_suffix("").parts)


def check(name):
    found = {}
    for path in package_files(name):
        v = violations(path.read_text(encoding="utf-8"), module_name(path), FORBIDDEN[name])
        if v:
            found[str(path.relative_to(ROOT))] = v
    return found


def test_domain_imports_nothing_forbidden():
    assert check("domain") == {}


def test_storage_integrations_do_not_import_api():
    assert check("storage") == {}
    assert check("integrations") == {}


def test_detector_flags_forbidden_import():
    src = "import sqlite3\nfrom flask import Flask\nfrom ..api import errors\nfrom . import rules\n"
    found = violations(src, "poltask.domain.x", FORBIDDEN["domain"])
    assert "sqlite3" in found and "flask" in found and "poltask.api" in found
    assert not violations("from . import rules\nimport json\n", "poltask.domain.x", FORBIDDEN["domain"])
