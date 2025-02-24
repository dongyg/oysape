#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sched, asyncio
import threading, os, json, traceback, logging, re
import time

from . import tools, apis, consts

schedule_demo = [
    {"title":"Demo schedule task", "type": "interval", "team":"7g8RSa3WaJD0wZNgcGUYPE", "interval": 5, "start": 10, "end": 20, "priority": 1, "action": ":Git pull Oysape @myocipro"},
    {"title":"Demo schedule pipeline", "type": "one_time", "team":"7g8RSa3WaJD0wZNgcGUYPE", "start": 10, "priority": 1, "action": "!Oysape server upgrade",},
]

indexServerSign = '@'
indexTaskSign = ':'
indexPipelineSign = '!'
runner = None
apiSchedulers = {}
OBH = ''
SCH_ITEMS = []

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
        self.loop = asyncio.new_event_loop()

    def start(self):
        """Start scheduler thread"""
        self.running = True
        self.thread.start()

    def run(self):
        """Run scheduler"""
        asyncio.set_event_loop(self.loop)
        while self.running:
            self.scheduler.run(blocking=False)
            self.loop.run_until_complete(asyncio.sleep(0.1))

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
        async def async_wrapper(*args, **kwargs):
            """Wrapper to run synchronous function in an asynchronous context"""
            return await self.loop.run_in_executor(None, action, *args, **kwargs)

        def interval_task(*args, **kw):
            now1 = time.time()
            # action(*argument, **kwargs)  # Execute the task
            future = asyncio.run_coroutine_threadsafe(async_wrapper(*argument, **kwargs), self.loop)
            next_time = now1 + interval  # Calculate next time to run
            while next_time <= now1:
                next_time += interval
            with self.lock:
                if not end_time or next_time < end_time:
                    # Schedule next task, passing along args and kw which are not used here but preserved
                    self.scheduler.enterabs(next_time, 1, interval_task, argument, kwargs)

        now2 = time.time()
        if now2 > start_time:
            # If current time is already past the initial start time, calculate the next valid start time
            start_time += ((now2 - start_time) // interval + 1) * interval
        with self.lock:
            # Schedule first task, passing initial argument and kwargs
            self.scheduler.enterabs(start_time, 1, interval_task, argument, kwargs)

def execScheduleFunction(functionObj, parameterObj):
    # Create a logdb instance to save the scheduler output
    global apiSchedulers
    if functionObj and callable(functionObj):
        b1 = False
        log_id = 0
        result = ''
        try:
            obh = parameterObj.get('obh')
            sch = parameterObj.get('sch')
            teamName = parameterObj.get('teamName')
            teamId = parameterObj.get('teamId')
            dbpath = os.path.join(apis.folder_base, 'scheduler.db')
            logdb = tools.SQLiteDB(dbpath)
            logdb.delete("DELETE FROM schedule_logs WHERE obh = ? AND sch = ? AND ts < strftime('%s', 'now', '-30 days')", (obh, sch))
            log_id = logdb.insert('INSERT INTO schedule_logs (ts, obh, sch, out1, out2) VALUES (?, ?, ?, ?, ?)', (int(time.time()), obh, sch, '', ''))
            apiSchedulers[teamId].log_id = log_id
            b1 = True
            print('Scheduled:', log_id, tools.getDatetimeStrFromTimestamp(time.time()), obh, sch, flush=True)
            result = str(functionObj(parameterObj)).strip()
            if result:
                print(result, flush=True)
            if parameterObj.get('runMode') == 'command':
                logdb.update("UPDATE schedule_logs SET out1 = COALESCE(out1, '') || ? WHERE id = ?", (result, log_id))
                scheduleObj = getScheduleObject(sch)
                if scheduleObj.get('recipients') and result:
                    out2 = re.search(scheduleObj.get('regex'), result) if scheduleObj.get('regex') else [result]
                    if out2:
                        apiSchedulers[teamId].sendNotification({'recipients': scheduleObj.get('recipients'), 'message': out2[0], 'mid': log_id, 'title': sch, 'obh': obh})
            # with open(os.path.join(apis.folder_base, 'scheduler.log'), 'a') as f:
            #     f.write('Scheduled execute: %s %s %s %s\n' % (obh, sch, time.time(), retval))
        except Exception as e:
            traceback.print_exc()
            if b1 and log_id:
                logdb.update("UPDATE schedule_logs SET out1 = COALESCE(out1, '') || ? WHERE id = ?", (traceback.format_exc(), log_id))

def initScheduler(obh, schedule_items):
    from . import apis
    global runner, apiSchedulers, OBH, SCH_ITEMS
    OBH = obh
    SCH_ITEMS = schedule_items if schedule_items else []
    dbpath = os.path.join(apis.folder_base, 'scheduler.db')
    logdb = tools.SQLiteDB(dbpath)
    logdb.query('CREATE TABLE IF NOT EXISTS schedule_logs (id INTEGER PRIMARY KEY,ts TIMESTAMP,obh TEXT,sch TEXT,out1 TEXT, out2 TEXT, ext1 TEXT, ext2 TEXT)')
    if runner:
        runner.stop()
    runner = ScheduledTaskRunner()
    runner.start()
    count = 0
    # print('Initializing scheduler...')
    apis.getApiObjectByTeam('')
    for item in SCH_ITEMS:
        teamName = item['tname']
        teamId = item['tid']
        if not teamId in apiSchedulers:
            apiSchedulers[teamId] = apis.ApiScheduler(clientId='scheduler_for_'+teamId, clientUserAgent='OysapeScheduler/%s'%consts.CLIENT_VERSION)
            apiSchedulers[teamId].teamId = teamId
            apiSchedulers[teamId].teamName = teamName
        # Load credentials for this webhost
        credWebhost = apiSchedulers[teamId].loadCredentials()
        apiSchedulers[teamId].reloadUserSession({'credentials': credWebhost})
        if item.get('running'):
            # print('Scheduled:', item.get('title'))
            functionObj = None
            parameterObj = None
            if item['action'].find(indexPipelineSign) == 0:
                pipelineName = item['action'][1:]
                functionObj = apiSchedulers[teamId].callPipeline
                parameterObj = {'obh': obh, 'sch': item.get('title'), 'runMode': item.get('runMode'), 'teamId': teamId, 'teamName': teamName, 'pipelineName': pipelineName}
            elif item['action'].find(indexServerSign) >= 0 or item['action'].find(indexTaskSign) >= 0:
                taskInput = parse_task_string0(item['action'])
                if taskInput.get('serverKey') and taskInput.get('taskKey'):
                    functionObj = apiSchedulers[teamId].callTask
                    parameterObj = {'obh': obh, 'sch': item.get('title'), 'runMode': item.get('runMode'), 'teamId': teamId, 'teamName': teamName, **taskInput}
            if item['type'] == 'one_time':
                delaySeconds = max(0, (item['start']/1000) - time.time())
                runner.schedule_one_time_task(delaySeconds, item.get('priority', 1), execScheduleFunction, (functionObj, parameterObj,))
            elif item['type'] == 'interval':
                runner.schedule_interval_task(item['start']/1000, item['interval'], item['end']/1000, execScheduleFunction, (functionObj, parameterObj,))
            count += 1
    print('Initialized', count, 'items in scheduler')
    for event in runner.scheduler.queue:
        print(tools.getDatetimeStrFromTimestamp(event.time), event.argument[1].get('sch'))
    return runner

def loadScheduleConfigAndInit(init=False):
    global OBH, SCH_ITEMS

    # Load schedule config
    webhostFile = os.path.join(apis.folder_base, 'webhost.json')
    if os.path.isfile(webhostFile):
        try:
            with open(webhostFile, 'r') as f:
                webhostObject = json.load(f)
            if init:
                initScheduler(webhostObject.get('obh'), webhostObject.get('schedules'))
            else:
                OBH = webhostObject.get('obh')
                SCH_ITEMS = webhostObject.get('schedules')
        except Exception as e:
            traceback.print_exc()
            logging.info(('Error', e))

def getScheduleObject(sch):
    for item in SCH_ITEMS:
        if item.get('title') == sch:
            return item
    return None


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
