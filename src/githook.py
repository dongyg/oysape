#!/usr/bin/env python
# -*- coding: utf-8 -*-

def handle_github_event(headers, payload):
    # Call the user-defined function
    event_type = headers.get('X-GitHub-Event')
    print(f"GitHub event: {event_type}")
    print(headers)
    print(payload)


def handle_bitbucket_event(headers, payload):
    # Call the user-defined function
    event_type = headers.get('X-Event-Key')
    print(f"Bitbucket event: {event_type}")
    print(headers)
    print(payload)

