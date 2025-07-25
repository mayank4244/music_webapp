# Start from Node.js base image
FROM node:20

# Install Python and other system dependencies
RUN apt update && apt install -y \
    python3 \
    python-is-python3 \
    ffmpeg \
    aria2 \
    curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Now run npm install (will succeed because python is available)
RUN npm install

# Copy the rest of your app
COPY . .

# Run the app
CMD ["node", "server.js"]
