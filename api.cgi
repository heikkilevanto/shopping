#!/usr/bin/perl
use strict;
use warnings;
use CGI;
use File::Copy qw(copy);

use feature 'unicode_strings';
use utf8;  # Source code and string literals are utf-8
binmode STDOUT, ":utf8"; # Stdout only. Not STDIN, the CGI module handles that
binmode STDERR, ":utf8"; #


# --- configuration ---
my $base_dir = "data";       # relative to index.cgi
my $username = $ENV{REMOTE_USER} || "heikki";  # from HTTP auth
my $path_info= $ENV{PATH_INFO} || "shop";
$path_info =~ s/ /_/g;  # skip spaces

my $file     = "$base_dir/$username" . $path_info;
my $fullfile = "$file.json";

# ensure dir exists

print STDERR "Shopping list: u='$username' f='$file' \n";

if ($ENV{REQUEST_METHOD} eq 'GET' && ($path_info eq '' || $path_info eq '/') ) {# List available files
      my $userdir = "$base_dir/$username";
      error(404,"User dir not found", $userdir)
        unless -d $userdir;
      chdir $userdir or error (500, "", "Can not chdir to $userdir");
      my $flist = `ls -t *.json`;
      chomp($flist);
      print STDERR "Got flist: '$flist' \n";
      my @files = split(/\n/, $flist);
      if (@files) {
        s/([^.]+)\.json/"$1"/ for @files;
        print "Content-Type: application/json\r\n\r\n";
        print "[", join(",", @files), "]\n";
        print STDERR "Returning list of files: [", join(",", @files), "]\n";
      } else {
          print "<p>No lists found.</p>\n";
      }
      # TODO - Delete old .DEL and .bak files, probably in the same loop
}

elsif ( $ENV{REQUEST_METHOD} eq 'GET' ) {  # return file contents
    error (400, "Bad Request", "Illegal file name '$path_info' " )
      unless ($path_info =~ /^\/?[a-zA-ZåÅæÆøØ0-9_]+$/ );
    open my $fh, "<:encoding(UTF-8)", "$fullfile" or
      error ("500","","Can not open '$fullfile'");
    print "Content-Type: application/json; charset=UTF-8\r\n\r\n";
    local $/;
    print <$fh>;
    close $fh;
}

elsif ($ENV{REQUEST_METHOD} eq 'POST') {
    error (400, "Bad Request", "Illegal file name" )
      unless ($path_info =~ /^\/?[a-zA-ZåÅæÆøØ0-9_]+$/ );
    binmode STDIN;
    my $cl = $ENV{CONTENT_LENGTH} || 0;
    print STDERR "POSTing to '$cl' bytes to '$fullfile' \n";
    my $new_content = '';
    my $read_total = 0;
    my $buffer = '';
    while ($read_total < $cl) {
        my $n = read(STDIN, $buffer, $cl - $read_total);
        die "Failed to read POST data" unless defined $n;
        last if $n == 0;  # EOF
        $new_content .= $buffer;
        $read_total += $n;
    }

    if (-e $fullfile) {
        copy($fullfile, "$fullfile.bak") or warn "Backup failed: $!";
     } else {
       print STDERR "File '$fullfile' does not exist, creating it\n";
    }

    open my $fh, ">", $fullfile or die "Cannot write $file: $!";
    print $fh $new_content;
    close $fh;
    print STDERR "Saved " . length($new_content) . " bytes to '$fullfile' \n";
    print "Content-Type: text/plain; charset=utf-8\n\n";
    print "OK\n";
}

elsif ($ENV{REQUEST_METHOD} eq 'DELETE') {
  # TODO
    my $list_name = $1;
    if (-f $fullfile) {
      my $del = "$fullfile.DEL";
      unlink ($del) if -f $del;
      rename($fullfile, $del) or error (500, "Internal Error", "Could not rename to $del");
      print "Status: 204 No Content\n\n";
    } else {
      error(404, "Not Found", "File '$fullfile' not found");
    }
}

else {
    error("400", "Unsupported method", "Unsupported method: '$ENV{REQUEST_METHOD}'  ");
}


sub error {
  my $code = shift || 500;
  my $codetext = shift || "Internal Error";
  my $msg = shift || "Unspecified error";
  $file = "" unless $file;
  print STDERR "ERROR: $ENV{REQUEST_METHOD} $file Error $code: $msg \n";
  print "Status: $code $codetext \r\n\r\n";
  print "$msg \n";
  exit;
}
