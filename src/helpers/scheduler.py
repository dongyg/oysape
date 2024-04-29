#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sched
import threading
import time

schedule_demo = [
    {"title":"Demo schedule task", "type": "interval", "team":"7g8RSa3WaJD0wZNgcGUYPE", "interval": 5, "start": 10, "end": 20, "priority": 1, "action": ":Git pull Oysape @myocipro"},
    {"title":"Demo schedule pipeline", "type": "one_time", "team":"7g8RSa3WaJD0wZNgcGUYPE", "start": 10, "priority": 1, "action": "!Oysape server upgrade",},
]

indexServerSign = '@'
indexTaskSign = ':'
indexPipelineSign = '!'
runner = None
apiSchedulers = {}

def parse_task_string0(s):
    v1 = s.find(':')
    v2 = s.find('@')
    if v1 >= 0 and v2 >= 0:
        if v1 < v2:
            return parse_task_string1(s)
        else:
            return parse_task_string2(s)
    elif v2 >= 0:
        return {'taskKey': '', 'serverKey': s.replace('@', '').strip()}
    else:
        return {'taskKey': '', 'serverKey': ''}

def parse_task_string1(s):
    import re
    regex = r':(.*?)@(.*)'
    matches = re.search(regex, s)
    if not matches:
        return {'taskKey': '', 'serverKey': ''}
    task = matches.group(1).strip()
    server = matches.group(2).strip()
    return {'taskKey': task, 'serverKey': server}

def parse_task_string2(s):
    import re
    regex = r'@(.*?):(.*)'
    matches = re.search(regex, s)
    if not matches:
        return {'taskKey': '', 'serverKey': ''}
    task = matches.group(2).strip()
    server = matches.group(1).strip()
    return {'taskKey': task, 'serverKey': server}

class ScheduledTaskRunner:
    def __init__(self):
        self.scheduler = sched.scheduler(time.time, time.sleep)
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.lock = threading.Lock()
        self.running = False

    def start(self):
        """Start scheduler thread"""
        self.running = True
        self.thread.start()

    def run(self):
        """Run scheduler"""
        while self.running:
            self.scheduler.run()

    def stop(self):
        """Stop scheduler"""
        self.running = False
        if not self.scheduler.empty():
            with self.lock:
                for event in self.scheduler.queue:
                    self.scheduler.cancel(event)
        # self.thread.join()

    def schedule_one_time_task(self, delay, priority, action, argument=(), kwargs={}):
        """Add one time task to scheduler"""
        with self.lock:
            self.scheduler.enter(delay, priority, action, argument, kwargs)

    def schedule_interval_task(self, start_time, interval, end_time, action, argument=(), kwargs={}):
        """Add interval task to scheduler"""
        def interval_task():
            next_time = time.time() + interval  # Calculate next time to run
            action(*argument, **kwargs)  # Execute the task
            with self.lock:
                if not end_time or next_time < end_time:
                    self.scheduler.enterabs(next_time, 1, interval_task)  # Schedule next task at absolute time

        current_time = time.time()
        if current_time > start_time:
            # If current time is already past the initial start time, calculate the next valid start time
            start_time += ((current_time - start_time) // interval + 1) * interval

        with self.lock:
            self.scheduler.enterabs(start_time, 1, interval_task)  # Schedule first task at absolute time


def initScheduler(schedule_items):
    from . import apis
    global runner, apiSchedulers
    if runner:
        runner.stop()
    else:
        runner = ScheduledTaskRunner()
        runner.start()
    for item in schedule_items:
        if item.get('running'):
            functionObj = None
            parameterObj = None
            teamName = item['team']
            if not teamName in apiSchedulers:
                apiSchedulers[teamName] = apis.ApiScheduler(clientId='scheduler_for_'+teamName, clientUserAgent='OysapeScheduler/2024.0422.1')
                apiSchedulers[teamName].teamName = teamName
            apiSchedulers[teamName].reloadUserSession()
            if item['action'].find(indexPipelineSign) == 0:
                pipelineName = item['action'][1:]
                functionObj = apiSchedulers[teamName].callPipeline
                parameterObj = {'pipelineName': pipelineName}
            elif item['action'].find(indexServerSign) >= 0 or item['action'].find(indexTaskSign) >= 0:
                taskInput = parse_task_string0(item['action'])
                if taskInput.get('serverKey') and taskInput.get('taskKey'):
                    functionObj = apiSchedulers[teamName].callTask
                    parameterObj = taskInput
            if item['type'] == 'one_time':
                delaySeconds = max(0, (item['start']/1000) - time.time())
                runner.schedule_one_time_task(delaySeconds, item.get('priority', 1), functionObj, (parameterObj,))
            elif item['type'] == 'interval':
                runner.schedule_interval_task(item['start']/1000, item['interval'], item['end']/1000, functionObj, (parameterObj,))
    return runner

# Sample usage
if __name__ == "__main__":
    def print_task(message):
        print(f"{time.ctime()}: {message}")

    runner = ScheduledTaskRunner()
    runner.start()

    # Run immediately
    runner.schedule_one_time_task(0, 1, print_task, ("Immediate task",))

    # Run in 5 seconds
    runner.schedule_one_time_task(5, 1, print_task, ("Scheduled task in 5 seconds",))

    # A interval task that runs every 2 seconds until 30 seconds
    start_time = time.time() + 10
    end_time = time.time() + 30
    runner.schedule_interval_task(start_time, 2, end_time, print_task, ("Interval task",))

    # Continue with other tasks or sleep
    time.sleep(35)
