#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sched
import threading
import time

schedule = [
    {"type": "interval", "interval": 5, "start": 10, "end": 20, "priority": 1, "action": lambda x: print(x), "argument": ("Hello",), "kwargs": {}},
    {"type": "one_time", "start": 10, "priority": 1, "action": lambda x: print(x), "argument": ("Hello",), "kwargs": "",},
]

class ScheduledTaskRunner:
    def __init__(self):
        self.scheduler = sched.scheduler(time.time, time.sleep)
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.lock = threading.Lock()

    def start(self):
        """Start scheduler thread"""
        self.thread.start()

    def run(self):
        """Run scheduler"""
        while True:
            self.scheduler.run()

    def schedule_one_time_task(self, delay, priority, action, argument=(), kwargs={}):
        """Add one time task to scheduler"""
        with self.lock:
            self.scheduler.enter(delay, priority, action, argument, kwargs)

    def schedule_interval_task(self, start_time, interval, end_time, action, argument=(), kwargs={}):
        """Add interval task to scheduler"""
        def interval_task():
            with self.lock:
                if time.time() < end_time:
                    action(*argument, **kwargs)
                    self.scheduler.enter(interval, 1, interval_task)

        delay = max(0, start_time - time.time())
        with self.lock:
            self.scheduler.enter(delay, 1, interval_task)

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
