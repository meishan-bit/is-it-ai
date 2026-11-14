#!/usr/bin/env python3
"""Pre/post analysis for the Is It AI? report (Erika's pandas step).

Input : the CSV from the admin dashboard ("Download responses (CSV)"), one row per answered example.
Output: printed tables, plus optional CSV files with --out-dir.

    python analysis/analyze_results.py responses.csv
    python analysis/analyze_results.py responses.csv --out-dir results/

Scoring follows the Week 1 test plan: 1 point for the verdict + 1 for the safe step, 10 points per form.
The warning-sign answer is tracked but not scored. With 3-5 testers we report each person's change and the
average, with no significance tests. The 20-percentage-point goal is exploratory.
"""
import argparse
import sys
from pathlib import Path

import pandas as pd

TARGET_PP = 20.0


def load(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    for col in ("verdict_correct", "sign_correct", "step_correct"):
        df[col] = df[col].astype(str).str.lower().eq("true")
    df["points"] = df["verdict_correct"].astype(int) + df["step_correct"].astype(int)
    df["time_s"] = df["time_ms"] / 1000.0
    return df


def prepost(df: pd.DataFrame) -> pd.DataFrame:
    tests = df[df["mode"].isin(["pre", "post"]) & df["completed_at"].notna()]
    # latest completed attempt per tester and mode
    last = tests.sort_values("completed_at").groupby(["anon_id", "mode"])["attempt_id"].last().reset_index()
    tests = tests.merge(last, on=["anon_id", "mode", "attempt_id"])
    per = tests.groupby(["anon_id", "mode"]).agg(points=("points", "sum"), items=("points", "size"), form=("form", "first")).reset_index()
    wide = per.pivot(index="anon_id", columns="mode", values=["points", "items", "form"])
    wide.columns = [f"{a}_{b}" for a, b in wide.columns]
    wide = wide.reset_index()
    for c in ("points_pre", "points_post"):
        if c not in wide:
            wide[c] = pd.NA
    wide["max_points"] = 10
    wide["change_points"] = wide["points_post"] - wide["points_pre"]
    wide["change_pp"] = wide["change_points"] / wide["max_points"] * 100
    keep = ["anon_id", "form_pre", "form_post", "points_pre", "points_post", "change_points", "change_pp"]
    return wide[[c for c in keep if c in wide]]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--out-dir")
    args = ap.parse_args()
    df = load(args.csv)
    pd.set_option("display.width", 140)

    pp = prepost(df)
    both = pp.dropna(subset=["points_pre", "points_post"])
    print("== Pre/post per tester ==")
    print(pp.to_string(index=False))
    if len(both):
        avg = both["change_pp"].mean()
        print(f"\nTesters with both checks: {len(both)} | average change: {both['change_points'].mean():+.1f} points ({avg:+.1f} percentage points)")
        print(f"Improved: {(both['change_pp'] > 0).sum()} of {len(both)} | exploratory goal of +{TARGET_PP:.0f} pp: {'reached' if avg >= TARGET_PP else 'not reached'}")
    else:
        print("\nNo tester has finished both checks yet.")

    test = df[df["mode"].isin(["pre", "post"])]
    per_item = test.groupby(["scenario_id"]).agg(answers=("points", "size"), verdict_pct=("verdict_correct", "mean"),
                                                  step_pct=("step_correct", "mean"), avg_time_s=("time_s", "mean")).reset_index()
    per_item[["verdict_pct", "step_pct"]] *= 100
    print("\n== Test items: accuracy and time ==")
    print(per_item.round(1).to_string(index=False))

    secondary = test.groupby("mode").agg(avg_time_s=("time_s", "mean"), sign_pct=("sign_correct", "mean")).reset_index()
    secondary["sign_pct"] *= 100
    print("\n== Secondary indicators (time per question; sign answer is tracked, not scored) ==")
    print(secondary.round(1).to_string(index=False))

    att = df.drop_duplicates("attempt_id")
    print("\n== Completion ==")
    print(att.groupby("mode").agg(started=("attempt_id", "size"), completed=("completed_at", lambda s: s.notna().sum())).to_string())

    if args.out_dir:
        out = Path(args.out_dir)
        out.mkdir(parents=True, exist_ok=True)
        pp.to_csv(out / "pre_post_per_tester.csv", index=False)
        per_item.to_csv(out / "test_item_accuracy.csv", index=False)
        print(f"\nSaved CSVs in {out}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
