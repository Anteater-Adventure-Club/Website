#!/bin/sh
set -eu

# All rolling instances use the same persistent store. Publish before Nginx
# starts, so a healthy candidate's HTML can be served by either instance.
source=${AAC_ASSET_SOURCE:-/usr/share/nginx/html/assets}
store=${AAC_ASSET_STORE:-/var/lib/aac/assets}
test -d "$source"
mkdir -p "$store"

find "$source" -type f | while IFS= read -r asset; do
    relative=${asset#"$source"/}
    destination=$store/$relative
    mkdir -p "${destination%/*}"
    if [ -f "$destination" ]; then
        if ! cmp -s "$asset" "$destination"; then
            echo "Asset URL already exists with different contents: $relative" >&2
            exit 1
        fi
        continue
    fi

    # Hard-link a complete temporary file into place atomically. Unlike a copy
    # to the final path, readers never see partial bytes; unlike mv, concurrent
    # publishers cannot overwrite an already published immutable URL.
    temporary=$(mktemp "$store/.publish-XXXXXX")
    trap 'rm -f "$temporary"' EXIT HUP INT TERM
    cp "$asset" "$temporary"
    chmod 644 "$temporary"
    if ! ln "$temporary" "$destination" 2>/dev/null; then
        if ! cmp -s "$asset" "$destination"; then
            echo "Cannot publish immutable asset: $relative" >&2
            exit 1
        fi
    fi
    rm -f "$temporary"
    trap - EXIT HUP INT TERM
done

# Never delete old hashes here: open tabs and rollback releases still need them.
