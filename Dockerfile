FROM python:3.11-slim-bullseye

RUN apt-get update && apt-get install ca-certificates curl -y && install -m 0755 -d /etc/apt/keyrings
RUN curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && chmod a+r /etc/apt/keyrings/docker.asc
RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
RUN apt-get update && apt-get install docker-ce-cli docker-compose-plugin -y

WORKDIR /approot

COPY gui ./gui
COPY src/www.py ./src/www.py
COPY src/webhost-setup.py ./src/webhost-setup.py
COPY src/helpers ./src/helpers

RUN pip install --no-cache-dir paramiko==3.3.1 bottle==0.12.25 gevent==24.2.1 gevent-websocket==0.10.1

CMD ["python", "src/www.py"]
