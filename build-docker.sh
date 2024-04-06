docker buildx create --use --name build-oysape --driver docker-container
docker buildx build --tag dongyg/oysape-webhost:latest --platform linux/amd64,linux/arm64 --push .
