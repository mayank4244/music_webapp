# Use official Node.js 18 base image
FROM node:18

# Install system dependencies: python3, ffmpeg, curl
RUN apt-get update && \
    apt-get install -y python3 ffmpeg curl && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy and install only dependencies first (for better Docker cache reuse)
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose the port used by your app (change if different)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
