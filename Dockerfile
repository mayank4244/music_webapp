# Start from Node.js base image
FROM node:20

# Install Python and system tools
RUN apt update && apt install -y \
    python3 \
    python-is-python3 \
    ffmpeg \
    aria2 \
    curl && \
    ln -s /usr/bin/python3 /usr/bin/python && \   # ← ADD THIS LINE
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install node dependencies (yt-dlp-exec now finds python)
RUN npm install

# Copy the rest of your app
COPY . .

# Start the server
CMD ["node", "server.js"]
