#!/bin/bash
# usage: pstree_signal.sh STOP|CONT|TERM <root pid>  -- signal a process and all its descendants
sig=$1; root=$2
kids() { for c in $(pgrep -P $1); do echo $c; kids $c; done; }
for p in $root $(kids $root); do kill -$sig $p 2>/dev/null; done
