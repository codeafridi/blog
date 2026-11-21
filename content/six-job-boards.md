---
title: Six job boards, one digest
date: 2026-11-15
summary: What building a small job digest taught me about filters — and why the number it prints is small on purpose.
tags: go, cli, tools
---

Every remote job board solves the same problem badly: it shows you everything, in the order an advertiser paid for. Reading four of them every morning is a part-time job with no salary. So I wrote [a small tool](https://github.com/codeafridi/jobwatch) that fetches six, ranks the postings against a profile, and prints the ones that are actually worth opening.

The interesting part was not the fetching. It was watching what a naive filter does.

## Remote and recent is not a signal

The first version scored a posting on location and freshness. It worked exactly as written:

```
28  SEA P2P Business Development Specialist
28  Virtual IOP Clinician â Florida & Texas
28  Compliance Officer/MLRO
```

Three different jobs, all "remote", all posted yesterday, none of them mine. The top of the list was noise because the filter had no idea what the job *was*.

The fix is one rule: a posting must match a role word in its title, or a matching tag, before it can appear at all. Location and freshness then decide the order among postings that already passed. A posting that is merely remote and new is not a candidate; it is an advertisement.

```
 62  Full Stack Engineer (mostly backend + API)   New Product · Remote
 36  Software Engineer / Backend Engineer         Hemant Singh · Remote
 20  Infrastructure Software Engineer             Dropbox · Poland
```

Same day, same boards, 412 postings fetched, 7 shown.

## Word boundaries are not a detail

Keyword matching looks trivial until you match on `go`. `Django` contains it, `Google` contains it, and every "Go-to-market" role contains it too. The matcher therefore works on word-ish boundaries:

```go
regexp.MustCompile(`(?i)(^|[^a-z0-9])` + regexp.QuoteMeta(term) + `($|[^a-z0-9])`)
```

That keeps `go`, `c++`, and `rust` honest without a tokenizer, and it costs one regex per term. For a few dozen terms over a few hundred postings, that is nothing.

## Region locks deserve a penalty, not a filter

The tool runs from India. Most "remote" postings are remote within a country: `US only`, `EU only`, `must be authorised to work in Canada`. Hiding them looks clever until a genuinely worldwide role with "US" somewhere in the text gets dropped by a crude filter.

So region locks cost points instead of failing outright. A posting can still surface if it is otherwise a strong match, and it sits below the ones that are actually open to me. The digest shows the assumption instead of silently enforcing it.

## What the small number means

Seven postings is not a failed run. The boards are mostly senior roles, sales roles, and reposted ads; a profile that avoids senior titles and region-locked jobs should not return forty results a day. If it does, the filter is not filtering.

The tool keeps a state file and prints each posting once, so tomorrow's digest contains tomorrow's postings, not the same list again. That turns out to matter more than the ranking: a digest you have already read is a digest you stop opening.

## What is still missing

Salary parsing is shallow. The Hacker News thread is parsed with the `Company | Role | Location` convention, which half the posters follow and half don't. And the scoring is a pile of constants tuned by looking at output, which is exactly as scientific as it sounds.

But it did replace four tabs with one screen, and the ranked list is short enough to read. That was the whole goal.
