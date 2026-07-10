# Requirements Document

## Introduction

This feature will add a social proof layer to Mental Health Wallet tools, allowing users to see how many others found a tool helpful, vote on tools, and receive community-informed recommendations. This builds on top of the Tool Rationale & Evidence Layer (see `tool-rationale-evidence` spec) by adding peer-validated trust signals alongside expert-sourced rationale.

## Status

**Not yet started.** This spec is a placeholder for future work.

## Planned Scope

- User voting / "this helped me" signals per tool
- Aggregated helpfulness counts displayed in the Rationale Sheet
- Community-informed tool recommendations
- Privacy-preserving aggregation (no individual usage exposed)
- Cold-start strategy for new tools with few votes

## Dependencies

- Requires `tool-rationale-evidence` spec to be implemented first (provides the Rationale Sheet display surface)
- Will require backend infrastructure for vote collection, aggregation, and sync

## Requirements

_To be defined when this spec is actively worked on._
