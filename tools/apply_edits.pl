use strict; use warnings;
# Applies a list of exact text edits to js files, refusing any file where a piece of text no longer matches.
#   perl tools/apply_edits.pl edits.txt
#   @@@ path relative to js/      then blocks of:
#   <<<  old text  ===  new text  >>>         (old must occur exactly once)
#   <<<RANGE  start  ===  end  >>>            (deletes from start up to, not including, end)
my $root = 'D:/Unholium_native/js/';
open my $E, '<:raw', $ARGV[0] or die; my $t = do { local $/; <$E> }; close $E; $t =~ s/\r\n/\n/g;
my (%ops, @order, $file); my @l = split /\n/, $t, -1; my $i = 0;
while ($i < @l) {
  my $x = $l[$i];
  if ($x =~ /^@@@ (.+)$/) { $file = $1; push @order, $file unless $ops{$file}; $ops{$file} ||= []; $i++; next; }
  if ($x =~ /^<<<(RANGE)?$/) { my $r = $1 ? 1 : 0; $i++; my (@a, @b); while ($l[$i] ne '===') { push @a, $l[$i++]; } $i++; while ($l[$i] ne '>>>') { push @b, $l[$i++]; } $i++; push @{$ops{$file}}, [$r, join("\n", @a), join("\n", @b)]; next; }
  $i++;
}
my $bad = 0;
for my $f (@order) {
  my $p = $root . $f; open my $F, '<:raw', $p or do { print "NOFILE $f\n"; $bad++; next; }; my $s = do { local $/; <$F> }; close $F;
  my $crlf = $s =~ /\r\n/ ? 1 : 0; $s =~ s/\r\n/\n/g; my @miss;
  for my $o (@{$ops{$f}}) {
    my ($r, $a, $b) = @$o; my $n = () = $s =~ /\Q$a\E/g;
    if ($n != 1) { push @miss, "($n) " . substr($a, 0, 90); next; }
    my $st = index($s, $a);
    if ($r) { my $en = index($s, $b, $st + length $a); if ($en < 0) { push @miss, "(no end) " . substr($b, 0, 90); next; } substr($s, $st, $en - $st) = ''; }
    else { substr($s, $st, length $a) = $b; }
  }
  if (@miss) { $bad++; print "MISS $f\n  $_\n" for @miss; next; }
  $s =~ s/\n/\r\n/g if $crlf; open my $O, '>:raw', $p or die; print $O $s; close $O; print "ok $f (", scalar @{$ops{$f}}, ")\n";
}
print $bad ? "FILES WITH MISSES: $bad\n" : "ALL APPLIED\n";
