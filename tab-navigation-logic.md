# Tab Navigation Logic

## Overview
The Tab Navigator extension maintains a chronological history of tab visits and provides back/forward navigation similar to browser history. This document explains how the navigation logic works in different scenarios.

## Core Concepts
- `tabHistory`: Array storing the sequence of visited tab IDs
- `currentIndex`: Current position in the history (points to active tab)
- `MAX_HISTORY_SIZE`: Maximum number of tabs to keep in history (60)

## Navigation Behaviors

### 1. Manual Tab Navigation
When a user manually switches to a tab (clicks tab, uses system shortcuts):

#### A. New Tab (not in history)
```
Initial:  [A, B, C] (current: C)
Action:   Switch to D
Result:   [A, B, C, D] (current: D)
```
- Tab is added to end of history
- currentIndex points to new end position
- If history exceeds MAX_HISTORY_SIZE, oldest tab is removed

#### B. Existing Tab (at end of history)
```
Initial:  [A, B, C] (current: C)
Action:   Switch to B
Result:   [A, C, B] (current: B)
```
- Tab is moved to end of history
- currentIndex points to new end position
- Maintains most recent visit order

#### C. Existing Tab (in middle of history after going back)
```
Initial:  [A, B, C] (current: A after going back)
Action:   Switch to B
Result:   [A, B, C] (current: B)
```
- Tab position in history is preserved
- Only currentIndex is updated
- Preserves forward history for "forward" command

### 2. Shortcut Navigation

#### A. Back Command
```
Initial:  [A, B, C] (current: C)
Action:   Back
Result:   [A, B, C] (current: B)
Action:   Back again
Result:   [A, B, C] (current: A)
```
- Moves currentIndex backward one position
- No modification to history array
- Stops at beginning of history

#### B. Forward Command
```
Initial:  [A, B, C] (current: A)
Action:   Forward
Result:   [A, B, C] (current: B)
Action:   Forward again
Result:   [A, B, C] (current: C)
```
- Moves currentIndex forward one position
- No modification to history array
- Stops at end of history

### 3. Tab Removal
When a tab is closed:

#### A. Remove tab before current
```
Initial:  [A, B, C] (current: C)
Action:   Close B
Result:   [A, C] (current: C)
```
- Tab removed from history
- currentIndex decreased by 1
- Maintains relative position to remaining tabs

#### B. Remove current tab
```
Initial:  [A, B, C] (current: B)
Action:   Close B
Result:   [A, C] (current: A)
```
- Tab removed from history
- currentIndex points to previous tab
- If no previous tab, points to new last position

#### C. Remove last tab in history
```
Initial:  [A] (current: A)
Action:   Close A
Result:   [] (current: -1)
```
- Tab removed from history
- If history becomes empty, currentIndex reset to -1

## Tab Validation and Cleanup

### Automatic Cleanup
The extension periodically checks for and removes non-existent tabs:
- Runs every 5 minutes
- Removes tabs that no longer exist in Chrome
- Adjusts currentIndex to maintain correct position
- Reinitializes history if all tabs become invalid

### Navigation with Invalid Tabs
When navigating through history:
1. Before navigation, validates all tabs and removes invalid ones
2. When going back:
   ```
   Initial:  [A, B*, C] (current: C) (* = closed tab)
   Action:   Back
   Result:   [A, C] (current: A)
   ```
   - Skips over invalid tabs
   - Continues backward until finding valid tab
   - Cleans up if no valid tabs found

3. When going forward:
   ```
   Initial:  [A, B*, C] (current: A) (* = closed tab)
   Action:   Forward
   Result:   [A, C] (current: C)
   ```
   - Skips over invalid tabs
   - Continues forward until finding valid tab
   - Cleans up if no valid tabs found

### Error Recovery
- If navigation fails due to invalid tab:
  1. Removes invalid tab from history
  2. Updates currentIndex if needed
  3. Attempts to navigate to next valid tab
  4. Reinitializes history if no valid tabs remain

## Example Scenarios

### Scenario 1: Simple Back Navigation
```
Start:    [A]
Manual:   A > C
History:  [A, C]
Back:     C > A
History:  [A, C] (current: A)
```

### Scenario 2: Back and Forward Navigation
```
Start:    [A]
Manual:   A > C > B
History:  [A, C, B]
Back:     B > C > A
History:  [A, C, B] (current: A)
Forward:  A > C > B
History:  [A, C, B] (current: B)
```

### Scenario 3: Manual Navigation After Back
```
Start:    [A]
Manual:   A > C > B
History:  [A, C, B]
Back:     B > C > A
History:  [A, C, B] (current: A)
Manual:   A > C
History:  [A, C, B] (current: C)
Back:     C > A
History:  [A, C, B] (current: A)
```

## State Persistence
- History state is saved to chrome.storage.local
- Recovers state after service worker restarts
- Periodically checks for state consistency 

## Performance Optimizations

### Tab Validation Caching
- Caches tab existence checks for 30 seconds
- Reduces API calls to Chrome tabs API
- Automatically cleans up expired cache entries
- Improves navigation response time

### Efficient Cleanup
- Runs every 15 minutes (reduced from 5 minutes)
- Skips cleanup if history is empty
- Validates all tabs in parallel
- Only updates state if changes detected
- Tracks last cleanup time to avoid redundant operations

### Smart Navigation
- Uses cached tab validation results
- Skips cleanup if done recently
- Batch processes tab validations
- Minimizes state updates and storage operations

### Memory Management
- Automatically cleans up validation cache
- Removes expired cache entries every 30 seconds
- Maintains optimal cache size
- Prevents memory leaks 