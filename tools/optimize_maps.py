#!/usr/bin/env python3
"""Aplica otimizações de mapas (erva + distâncias) no branch atual."""
from pathlib import Path

def patch_gazon(p: Path):
    t = p.read_text(encoding="utf-8")
    t2 = t.replace("GRASS.dens par m², 80)", "GRASS.dens par m², 28)")
    t2 = t2.replace("dens: 80,", "dens: 28,")
    if t2 == t:
        print("gazon: sem alterações (já otimizado ou texto diferente)")
    else:
        p.write_text(t2, encoding="utf-8")
        print("gazon: dens 80 → 28")

def patch_core(p: Path):
    t = p.read_text(encoding="utf-8")
    reps = [
        ("grass: [1, 40, 14]", "grass: [0.55, 22, 8]"),
        ("grass: [0.8, 34, 11]", "grass: [0.45, 18, 7]"),
        ("grass: [0.65, 28, 9]", "grass: [0.35, 15, 6]"),
        ("grass: [0.5, 22, 7]", "grass: [0.3, 12, 5]"),
        ("detail: 90, scatter: 44", "detail: 55, scatter: 28"),
        ("detail: 70, scatter: 38", "detail: 45, scatter: 24"),
        ("detail: 60, scatter: 32", "detail: 38, scatter: 20"),
        ("detail: 40, scatter: 24", "detail: 28, scatter: 16"),
        ("detail: 24, scatter: 14", "detail: 18, scatter: 10"),
    ]
    t2 = t
    for a, b in reps:
        if a not in t2:
            print(f"core: padrão não encontrado: {a}")
        else:
            t2 = t2.replace(a, b, 1)
    if t2 == t:
        print("core: sem alterações")
    else:
        p.write_text(t2, encoding="utf-8")
        print("core: QUALITY grass/detail/scatter otimizados")

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    patch_gazon(root / "src" / "02nb-gazon.js")
    patch_core(root / "src" / "01-core.js")
    print("Feito. Revisa o diff e faz commit.")
