FROM node:18

# Install python3 and link it as `python`, and also install ffmpeg and yt-dlp
RUN apt-get update && \
    apt-get install -y python3 ffmpeg curl && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the files
COPY . .

# Expose your app port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
