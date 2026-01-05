#!/usr/bin/perl
use strict;
use warnings;
use CGI;
use File::Basename qw(dirname basename);
use File::Path qw(make_path);
use POSIX qw(strftime);
use feature 'unicode_strings';
use utf8;
# Do NOT set binmode STDOUT to utf8 - will corrupt binary image data
# Set it per-response as needed
binmode STDERR, ":utf8";

my $photos_dir = "photo";     # sibling to data/
my $remote_user = $ENV{REMOTE_USER} || "heikki";
my $path_info = $ENV{PATH_INFO} || ""; # e.g. /upload or /user/filename
$path_info =~ s/\s/_/g;

my $q = CGI->new;

if ($ENV{REQUEST_METHOD} eq 'POST') {
    # Expect POST to /upload
    unless ($path_info =~ m{^/upload(?:/.*)?$}) {
        return_error(400, "Bad Request", "Upload must POST to /upload");
    }

    my $upload_field = 'photo';
    my $upload_fh = $q->upload($upload_field);
    unless ($upload_fh) {
        return_error(400, "Bad Request", "No uploaded file in field '$upload_field'");
    }

    my $client_name = $q->param($upload_field) || '';
    # Use client's filename but sanitize it (basename, allow only safe chars)
    $client_name = basename($client_name);
    print STDERR "UPLOAD: user=$remote_user field=$upload_field client_name=$client_name\n";
    unless ($client_name =~ /^[A-Za-z0-9_\-\.]+$/) {
        return_error(400, "Bad Request", "Illegal filename provided");
    }
    my ($ext) = ($client_name =~ /\.([A-Za-z0-9]+)$/);
    $ext = lc($ext || 'jpg');
    my %allowed_ext = map { $_ => 1 } qw(jpg jpeg png webp gif jpeg);
    unless ($allowed_ext{$ext}) {
        return_error(400, "Bad Request", "Disallowed file extension: $ext");
    }

    # Try to get Content-Type from upload info
    my $info = $q->uploadInfo($upload_fh) || {};
    my $content_type = $info->{'Content-Type'} || $ENV{'CONTENT_TYPE'} || '';
    $content_type = lc($content_type);
    my %allowed_ct = map { $_ => 1 } qw(image/jpeg image/jpg image/png image/webp image/gif);
    unless ($content_type eq '' || $allowed_ct{$content_type}) {
        # Not a known image content-type. We'll still allow if ext is allowed.
        unless ($allowed_ext{$ext}) {
            return_error(400, "Bad Request", "Disallowed image type: $content_type");
        }
    }

    # enforce reasonable size (if CONTENT_LENGTH provided)
    my $cl = $ENV{CONTENT_LENGTH} || 0;
    my $max_bytes = 5 * 1024 * 1024; # 5 MB
    if ($cl && $cl > $max_bytes) {
        return_error(413, "Payload Too Large", "Upload exceeds $max_bytes bytes");
    }

    # ensure user dir exists under photos/<user>
    my $user_dir = "$photos_dir/$remote_user";
    unless (-d $user_dir) {
        print STDERR "$user_dir does not exist, creating it \n";
        make_path($user_dir) or return_error(500, "Internal Error", "Cannot create directory $user_dir: $!");
    }

    # Use client's filename (sanitized) as saved name; overwrite if exists
    my $saved_name = $client_name;
    my $saved_path = "$user_dir/$saved_name";
    print STDERR "Saving upload to $saved_path\n";

    # write file
    open my $out, ">:raw", $saved_path or return_error(500, "Internal Error", "Cannot write file: $!");
    binmode $out;
    my $buffer;
    my $total = 0;
    while (my $n = read($upload_fh, $buffer, 8192)) {
        print $out $buffer;
        $total += $n;
        if ($total > (10 * 1024 * 1024)) { # safety hard limit 10MB
            close $out;
            unlink $saved_path;
            return_error(413, "Payload Too Large", "Upload exceeds hard limit");
        }
    }
    close $out;

    # Set permissive read perms
    chmod 0644, $saved_path;
    print STDERR "Saved $saved_path ($total bytes)\n";

    # Return JSON with filename only (no URL)
    binmode STDOUT, ":utf8";  # Safe for JSON response
    print "Content-Type: application/json; charset=utf-8\r\n\r\n";
    my $json = sprintf('{"ok":true,"filename":"%s","size":%d}', $saved_name, $total);
    print $json, "\n";
    exit;
}

elsif ($ENV{REQUEST_METHOD} eq 'GET') {
    # Expect path_info like /<user>/<filename>
    my ($u, $f) = ($path_info =~ m{^/([^/]+)/([^/]+)$});
    unless ($u && $f) {
        return_error(400, "Bad Request", "GET must be /<user>/<filename>");
    }

    # Only allow REMOTE_USER to access their own files
    if ($remote_user ne $u) {
        return_error(403, "Forbidden", "User mismatch");
    }

    # sanitize filename
    unless ($f =~ /^[A-Za-z0-9_\-\.]+$/) {
        return_error(400, "Bad Request", "Illegal filename");
    }

    my $file_path = "$photos_dir/$u/$f";
    unless (-f $file_path) {
        return_error(404, "Not Found", "File not found");
    }

    # determine content-type by extension
    my ($ext) = ($f =~ /\.([^.]+)$/);
    $ext = lc($ext || 'jpg');
    my %ctmap = (
        jpg => 'image/jpeg', jpeg => 'image/jpeg', png => 'image/png', webp => 'image/webp', gif => 'image/gif'
    );
    my $ctype = $ctmap{$ext} || 'application/octet-stream';

    # stream file
    if (open my $fh, '<:raw', $file_path) {
        binmode $fh;
        binmode STDOUT, ":raw";  # Critical: output raw bytes for image
        print "Content-Type: $ctype\r\n";
        print "Content-Length: " . (-s $file_path) . "\r\n\r\n";
        my $buf;
        while (my $n = read($fh, $buf, 8192)) {
            print $buf;
        }
        close $fh;
        exit;
    } else {
        return_error(500, "Internal Error", "Cannot open file");
    }
}

else {
    return_error(400, "Bad Request", "Unsupported method");
}

sub return_error {
    my ($code, $title, $msg) = @_;
    $code ||= 500;
    $title ||= 'Error';
    $msg ||= '';
    print STDERR "ERROR: $ENV{REQUEST_METHOD} $path_info $code: $msg\n";
    print "Status: $code $title\r\n\r\n";
    print "$msg\n";
    exit;
}
