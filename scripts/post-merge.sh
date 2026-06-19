#!/bin/bash
set -e

pnpm install --frozen-lockfile
pnpm --filter db push

# GitHub sync is handled by Replit's native Git integration.
