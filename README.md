# DeadGuess Research

**An autonomous, Linux-native AI research desk that hunts for trading edges—and keeps a forensic record of every attempt, especially the failures.**

<p align="left">
  <a href="https://deadguess.com/"><strong>Explore the Live Research Workbench (Fieldnotes) →</strong></a>
</p>

DeadGuess Research runs 24/7 unattended quantitative research using heterogeneous AI agents across US equities, options, and crypto. Instead of curve-fitting backtests, every idea is framed as a falsifiable economic mechanism, tested against strict point-in-time historical account replay, judged against criteria frozen in advance, and cross-audited by a rival model family with zero session memory.

---

## Architecture

<p align="center">
  <img src="https://github.com/user-attachments/assets/3d5de5e2-b23f-4e40-964a-cd73b1c84b98" alt="DeadGuess Research Architecture" width="740" />
</p>

---

## Autonomous CLI & Live Telemetry

<p align="center">
  <img src="https://github.com/user-attachments/assets/70bf6ea1-5b77-41b6-852d-6440e66f9903" alt="DeadGuess Research CLI Controller" width="760" />
  <br />
  <sub><strong>Unified CLI Controller:</strong> Quota-aware scheduling, sliding window telemetry, and crash-safe lease recovery.</sub>
</p>

<table align="center">
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/5b0145e5-360f-43a8-b5cc-44e2f818dd87" alt="Dual-Line tmux Execution" width="100%" />
      <br />
      <sub><strong>Dual-Line Concurrency:</strong> Codex and Claude operating in isolated worktrees.</sub>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/7d34a86e-9ab2-4c6a-859b-8a6d794a75a4" alt="Out-of-Sample Gate Evaluation" width="100%" />
      <br />
      <sub><strong>Pre-Registered Gates:</strong> Automated liquidity, borrow-cost, and corporate-action checks.</sub>
    </td>
  </tr>
</table>

---

## What Makes It Different

**Mechanisms, not curve-fitting.** Research is organized around *Guesses*: a specific economic mechanism—such as *"SEC late filers continue to drift after accounting for borrow costs and liquidity"*—tracked through numbered study rounds until an independent expert rules it dead, promising, or confirmed.

**Rules frozen before results.** The research specification, ex-ante statistical power requirements, and pass/fail gates are cryptographically pinned before any return series is touched. Any change made after observing returns is strictly quarantined as exploratory development, never validation proof.

**Two model families, zero collusion.** Two isolated research lines run concurrently in separate Git worktrees—one driven by **Claude**, one by **Codex**. Each line must pass an internal expert review (e.g., rejecting low-power designs before data API quota is spent) just to freeze a plan. Closing a Guess triggers a **cross-model blind audit**: a fresh, zero-memory process from the opposing model family inspects a neutralized evidence packet with the author's identity and outcome framing stripped.

**Forensic point-in-time integrity.** Source captures are SHA-256 fingerprinted, causal clocks enforce exact point-in-time availability, and corporate actions, T+1 cash settlement, borrow fees, and liquidity tiers are explicitly modeled. Every external data request and trial is metered against a pre-authorized reservation budget.

**Honest classification.** *"Data/entitlement blocked"*, *"zero signal overlap"*, *"illiquid / unshortable"*, and *"negative net excess"* are recorded as distinct, immutable outcomes—never silently repaired or swept under the rug.

---

## Linux-Native Operations

Engineered to run as a lightweight, self-healing daemon on **Linux / WSL**—extracting continuous institutional-grade research throughput out of standard flat-rate CLI subscriptions without burning thousands of dollars in raw API token bills:

- **Dual-line `tmux` orchestration:** A single shell entrypoint (`research`) manages parallel Codex and Claude research lanes in the background.
- **Quota-aware throttling (`Run to 5%`):** Tracks 5-hour and weekly sliding usage windows in real time, gracefully committing state, syncing study rounds, and parking sessions before hitting rate-limit walls.
- **Stateful handoffs & lease recovery:** Kernel file locks, automated deadlock recovery (`Release a stuck lease`), and clean checkpoints allow the owner to pause overnight, approve data budgets, or resume multi-hour study rounds without fracturing the agent's implicit reasoning context.
- **Local-first & zero leakage:** All market caches, Git branches, and private review receipts remain strictly on the local Linux filesystem. Nothing phones home.

---

## Selected Autopsy Highlights (138+ Studies)

Across 138+ study rounds and 170+ documents, the governance harness has systematically caught and executed false positives that routinely slip past standard backtesters:

- **Killing a $t = 3.0$ "Holy Grail" (`DA011`):** A 34-quarter out-of-sample short study on SEC late filers initially showed **+4.4% per quarter ($t = 3.0$, 22 of 30 quarters positive)**. The pre-registered tradability gate (`S6`: $\ge$\$300M cap, $\ge$\$20M daily dollar volume, 3% borrow fee) automatically proved the profit was an unshortable micro-cap mirage (**-0.9% per quarter** in liquid names)—while the agent simultaneously caught, disclosed, and isolated a **+2,455%** phantom short gain caused by *Sigma Designs'* cash liquidation payout being misclassified as a stock split.
- **Cross-model adversarial forensics (`EQG001`):** When the Codex research line closed a study citing *"3,343 passed audit assertions"*, the zero-memory **Claude Reviewer** dissected the neutral packet, proved the researching agent's study-level assertions were mere row-count bookkeeping rather than true signal replay, caught an unlogged archive extraction, and flagged a timestamp-overwrite loophole in the study script.

Read the full, unedited Owner Reports in the **[Live Research Workbench →](https://deadguess.com/)**.

---

## System Components

- **Research Controller:** Enforces pre-registration freezes, request reservations, ex-ante statistical power gates, and cross-model blind review receipts.
- **Causal Backtest Engine:** Funded-account historical replay with independent arithmetic verification (reconstructing NAV without importing strategy code), T+1 settlement, L1 quote invalidation handling, and corporate-action quarantine.
- **Provenance Data Layer:** Hash-verified adapters and read-only shared caches for US equities, intraday quotes, and SEC EDGAR filings.
- **DeadGuess Research Workbench:** A minimalist, local-first web interface for browsing Fieldnotes, study lineages, and merged Owner Reports.

## Boundaries

DeadGuess Research is a quantitative research governance and falsification engine, not a live execution bot. It places no brokerage orders and provides no investment advice. A candidate specification is recognized as viable only after surviving pre-registered validation on genuinely unexposed holdout data.

---

## Deployment & Inquiries

This repository hosts the public overview and selected research archive for **DeadGuess Research**. The core Linux orchestration daemon, causal backtesting engine, and cross-model audit harness are maintained in a private repository.

For **boutique quant funds, prop desks, and family offices** looking to deploy a local-first, anti-overfitting AI research pipeline on proprietary data feeds—or for **commercial licensing, turnkey setup, and Quant AI Infrastructure roles** (based in Canada; authorized for contract & part-time engagements):

- **Contact:** `daiyue.han@outlook.com`, [Telegram](https://t.me/CrystalBytes)
<sub>© 2026 DeadGuess Research. Published research artifacts available for inspection; core engine all rights reserved.</sub>
