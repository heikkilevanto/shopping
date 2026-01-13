#!/usr/bin/perl
use File::stat;

print <<'END';


<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shopping Lists</title>
</head>
<body>
END

sub scriptlink {
  my ($f, $type) = @_;
  $type //= 'script';
  if ( !-r $f ) {
    print "Can not stat $f <br/>\n";
    return;
  }
  my $v = stat($f)->mtime;
  if ($type eq 'stylesheet') {
    print "<link rel='stylesheet' href='$f?v=$v'>\n";
  } else {
    print "<script src='$f?v=$v'></script>\n";
  }
}

my $user = $ENV{REMOTE_USER} // '??';
$user = ucfirst($user);
print "<script>const currentUser = '$user';</script>\n";

scriptlink("shopping.css", "stylesheet");

scriptlink("util.js");
scriptlink("state.js");
scriptlink("storage.js");
scriptlink("list-operations.js");
scriptlink("rendering.js");
scriptlink("drag.js");
scriptlink("menu.js");
scriptlink("journal.js");
scriptlink("add-item.js");
scriptlink("photo.js");

scriptlink("shopping.js");
