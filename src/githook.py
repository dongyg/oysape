#!/usr/bin/env python
# -*- coding: utf-8 -*-

from helpers import apis

def handle_github_event(headers, payload):
    # Call the user-defined function
    event_type = headers.get('X-Github-Event')
    print(f"GitHub event: {event_type}")
    print(headers)
    print(payload)
    # # Get the API object by team name
    # apiObj = apis.getApiObjectByTeam('Demo Team')
    # if apiObj:
    #     # Call a task or pipeline if API object is found. runMode=command will get the output synchronously
    #     print(apiObj.callTask({'runMode':'command', 'taskKey':'hello', 'serverKey':'localhost'}))
    #     # Send a notification to users by emails
    #     print(apiObj.sendNotification({'recipients':[], 'title':"Hello, World!", 'message':"Hello, World!"}))


def handle_bitbucket_event(headers, payload):
    # Call the user-defined function
    event_type = headers.get('X-Event-Key')
    print(f"Bitbucket event: {event_type}")
    print(headers)
    print(payload)
    # # Get the API object by team name
    # apiObj = apis.getApiObjectByTeam('Demo Team')
    # if apiObj:
    #     # Call a task or pipeline if API object is found. runMode=command will get the output synchronously
    #     print(apiObj.callPipeline({'runMode':'command', 'pipelineName':'hello world'}))
    #     # Send a notification to users by emails
    #     print(apiObj.sendNotification({'recipients':[], 'title':"Hello, World!", 'message':"Hello, World!"}))
