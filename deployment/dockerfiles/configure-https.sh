#!/bin/sh
set -eu

https_enabled=${ENABLE_HTTPS:-false}
include_file=/etc/nginx/https-enabled.conf
template_file=/etc/nginx/nginx-https.conf.template

: > "$include_file"
if [ "$https_enabled" != "true" ]; then
    exit 0
fi

certificate_path=
private_key_path=
for certificate_name in fullchain1.pem fullchain.pem server.crt cert.pem; do
    for certificate in $(find /etc/nginx/certs -type f -name "$certificate_name" 2>/dev/null); do
        certificate_dir=$(dirname "$certificate")
        for key_name in privkey1.pem privkey.pem server.key key.pem; do
            if [ -f "$certificate_dir/$key_name" ]; then
                certificate_path=$certificate
                private_key_path=$certificate_dir/$key_name
                break 2
            fi
        done
    done
done

if [ -z "$certificate_path" ] || [ -z "$private_key_path" ]; then
    echo "ENABLE_HTTPS is true, but no supported certificate/key pair was found; starting HTTP only." >&2
    exit 0
fi

export CERTIFICATE_PATH="$certificate_path"
export PRIVATE_KEY_PATH="$private_key_path"
envsubst '${CERTIFICATE_PATH} ${PRIVATE_KEY_PATH}' < "$template_file" > "$include_file"
