FROM python:3.11-slim-bullseye

WORKDIR /approot

COPY gui ./gui
COPY src/www.py ./src/www.py
COPY src/webhost-setup.py ./src/webhost-setup.py
COPY src/helpers ./src/helpers

RUN pip install --no-cache-dir paramiko==3.3.1 bottle==0.12.25 gevent==24.2.1 gevent-websocket==0.10.1

CMD ["python", "src/www.py"]