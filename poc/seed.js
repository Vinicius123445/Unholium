// Both builds run from the same dice, so a difference in the pictures is a difference in the drawing.
(() => { let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
