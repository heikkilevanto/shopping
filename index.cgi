#!/usr/bin/perl
use File::stat;

print <<'END';


<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shopping Lists</title>
<style>
  body { font-family: sans-serif; padding: 1em; }
  #top-menu { margin-bottom: 1em; }
  #list-container { margin-top: 1em; }
  .section { border: 1px solid #ccc; margin: 0.5em 0; padding: 0.5em; }
  .section-header { font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 0.5em; }
  .section-header .title { flex: 1; text-align: left; min-width: 0; }
  .line { padding: 0.2em 0; display: flex; align-items: center; }
  .line-text { margin-left: 0.5em; flex: 1; cursor: text; }
  .section-header, .line { flex-wrap: wrap; }
  .menu { margin-left: 0.5em; }
  .list-preview {
    flex: 0 0 15em;
    width: 16em;
    height: 12em;
    overflow: hidden;
    white-space: nowrap;
    font-size: 0.55em;
    border: 2px solid black;
     border-radius: 0.5em;
    padding: 0.3em;
    box-sizing: border-box;
  }
  #list-index {
    display: flex;
    flex-wrap: wrap;        /* wrap to next line */
    gap: 0.5em;             /* space between boxes */
  }
  @media (max-width: 600px) {
    body { padding: 0.5em; }
    .section { padding: 0.3em; }
    .line { padding: 0.1em 0; }
    .menu { margin-left: 0; }
  }
</style>
</head>
<body>
END

sub scriptlink {
  my $f = shift;
  if ( !-r $f ) {
    print "Can not stat $f <br/>\n";
    return;
  }
  my $v = stat($f)->mtime;
  print "<script type='module' src='$f?v=$v'></script>\n";
}

my $user = $ENV{REMOTE_USER} // '??';
$user = ucfirst($user);
print "<script>const currentUser = '$user';</script>\n";

scriptlink("drag.js");
scriptlink("shopping.js");
