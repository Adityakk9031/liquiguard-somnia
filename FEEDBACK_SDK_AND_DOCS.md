# Feedback: Somnia SDK and Documentation

**Project:** LiquiGuard (Somnia Shannon Testnet, Chain ID 50312)  
**Stack:** `@somnia-chain/markets-sdk` (daemon), LiquiGuardVault keeper, Next.js frontend  
**Date:** September 2026

This note is submitted as the optional hackathon **SDK and documentation feedback** report. It reflects what we actually hit while building an automated micro-hedge keeper on Shannon.

---

## Praise

`@somnia-chain/markets-sdk` made the **shape** of DreamDEX integration easy to reason about:

- **IOC construction** maps cleanly to a keeper pipeline: market id, side (`DOWN` / `UP`), size, limit price, and time-in-force. We could model `placeIOCOrder` and settlement as a small, testable client even when running in mock mode.
- **Binary market discovery** (underlying, strike, expiry, UP/DOWN prices) matches how Event Contracts are explained in docs: a DOWN contract is a parametric payoff, not a custom AMM curve. That let us treat DreamDEX as **micro-insurance** for a vault health factor, not as a trading UI.

The SDK’s types and GraphQL/indexer orientation are a good fit for bots that poll markets and fire IOC orders without a browser wallet.

---

## Actionable improvement 1 — Block-range helper for Shannon logs

**Issue:** `eth_getLogs` / `getContractEvents` on **Somnia Shannon** reject (or time out on) wide ranges. In practice we had to cap each query at **≤ ~900–1000 blocks**. Scanning from block `0` or 8,000-block windows failed silently or hung. That broke wallet-linked activity until we chunked queries ourselves.

**Ask:** Add a first-party helper, for example:

```ts
getLogsChunked({ address, event, args, fromBlock, toBlock, maxSpan: 900 })
```

that pages automatically and merges results. Document the Shannon (and mainnet) **max span** next to `getLogs` examples. Keepers and indexers all hit this; it should not be tribal knowledge.

We implemented the same pattern in LiquiGuard’s daemon (`daemon/src/activity.ts`) for vault events (`CollateralDeposited`, `DebtBorrowed`, `HedgeExecuted`, etc.).

---

## Actionable improvement 2 — Embedded wallet vs keeper private key

**Issue:** DreamDEX / Somnia frontend docs centre on the **user in the browser** (Connect wallet, embedded wallet, sign in the UI). Automated keepers are a different actor:

| Role | Who signs | Key lives where |
|------|-----------|-----------------|
| User | MetaMask / embedded wallet | Browser — never on the server |
| Keeper | `PRIVATE_KEY` | Daemon host (e.g. Render) — no popup |

LiquiGuard’s crash demo is **user-triggered, keeper-executed**: the judge clicks Simulate Crash; `executeProtectionHedge` is sent by the operator account. If docs only show frontend signing, teams under-fund the operator, put the user key on the server, or point `PRIVATE_KEY` at the **contract address** instead of the deployer/operator EOA.

**Ask:** A short “Building a keeper” page that states:

1. The contract `operator` is an **EOA** (or dedicated relayer), not the vault address.
2. That EOA needs **native gas (STT)** plus any tokens the keeper must `transferFrom` (e.g. payout tUSDC).
3. Frontend `NEXT_PUBLIC_*` URLs must point at the live daemon; localhost will not rescue a judge on Vercel.
4. Never commit `PRIVATE_KEY`; inject it in the host’s secret store (`sync: false` on Render).

That distinction would have saved us several explanation cycles and is the difference between a demo that survives a live crash click and one that dies on `Unauthorized` or out-of-gas.

---

## Context (what we built)

LiquiGuard monitors vault health factor on Shannon, sizes a mock DreamDEX **DOWN** IOC when HF &lt; 1.30, and repays debt on-chain via `LiquiGuardVault.executeProtectionHedge`. Default daemon mode is **`DREAMDEX_MODE=mock`** with the SDK loaded for live-shaped APIs; the repay transaction is real testnet state.

Thank you to the Somnia and DreamDEX teams for Shannon RPC, Event Contracts, and the markets SDK.
