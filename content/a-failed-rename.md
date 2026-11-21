---
title: A failed rename is not a reorder
date: 2026-11-21
summary: CopyQ's sync plugin reported success after a file operation failed. The bug was one word, and the fix was not the interesting part.
tags: copyq, c++, testing
---

CopyQ keeps a tab of clipboard history on disk when you point it at a folder: one file per item, named after the time it was copied, so the order on screen is the order of the names. Reordering items means renaming their files. That is the whole design, and it is a good one until a rename fails.

The report was specific. On Windows, another program held a handle on one of those files. CopyQ moved the rows, failed to rename the files, and said nothing. Rename again and it still did not work, because the pending reorder had already been marked as done. The screen showed the new order; the disk showed the old one. Nothing was going to reconcile them.

## The one word

The function that renames and copies the files returned `true` even when it had skipped an item:

```cpp
if ( !moveFormatFiles(oldBasePath, newBasePath, mimeToExtension) ) {
    qCWarning(fileWatcher) << "Skipping rename of" << olderBaseName;
    continue;   // ...and later: return true;
}
```

`continue` is right — one locked file should not stop the others. Returning `true` afterwards is not. The caller treats that value as "the batch is applied", clears the pending state, and schedules nothing else. A failure that the code already knew about was being erased one frame up.

So the first half of the fix is small: track whether anything failed, and return that instead.

## A failure needs somewhere to go

Propagating the boolean alone would have made things quieter, not better: the caller would return early and the reorder would sit half-applied with nothing to wake it up.

The watcher already had a timer for batching moves. On failure it now reschedules that timer with a delay that doubles from 100 ms up to 5 s, and the delay resets when a batch finally succeeds:

```cpp
if ( !renameMoveCopy(m_dir, indexList, UpdateType::Changed) ) {
    m_moveRetryDelayMs = qMin( qMax(m_moveRetryDelayMs * 2, moveRetryMinDelayMs),
                               moveRetryMaxDelayMs );
    m_moveTimer.start(m_moveRetryDelayMs);
    return;
}
m_moveRetryDelayMs = 0;
```

The cap matters. A file that stays locked for a day should cost one wake-up every five seconds, not a spin at full speed. The reset matters too, otherwise one bad minute would slow every later move.

## Testing a file lock without a file lock

Here is where it got annoying. The trigger is a Windows file handle. On Linux, `rename` inside a writable directory almost never fails, and the ways to force it are not portable:

- Making the directory read-only also breaks the plugin's lock file, which turns the test into a different bug.
- Deleting the source file makes the rename fail, but the file watcher notices and removes the item.
- Injecting a failure in production code to make a test pass is not a fix I want to ship.

I verified it by injecting the failure locally: make the first rename return false, run the move, watch the retry rename the files, then remove the injection. Red without the change, green with it. The pull request says exactly that, because a maintainer deserves to know which part was exercised and which part was reasoning.

## What I would keep

Two habits came out of this that I want to keep:

1. When a loop decides to skip an item, check what the function returns. Partial success is still failure for the caller if it promised a complete batch.
2. A failure that nobody retries is a data-loss bug with a delay. If the operation matters, it needs a queue, a timer, or a person — not a log line.

The diff is 18 lines. Most of the work was deciding where the failure was allowed to go.
