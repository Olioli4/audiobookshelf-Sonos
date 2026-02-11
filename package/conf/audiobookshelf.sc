[sonos_ssdp]
title="Sonos SSDP Discovery"
desc="Audiobookshelf Sonos Integration"
port_forward="no"
dst.ports="1900,1905/udp"

[sonos_http_api]
title="Sonos HTTP API"
desc="Audiobookshelf Sonos Control"
port_forward="yes"
dst.ports="5005/tcp"

[audiobookshelf_web]
title="Audiobookshelf Web Interface"
desc="Audiobookshelf Server"
port_forward="yes"
dst.ports="13378/tcp"
