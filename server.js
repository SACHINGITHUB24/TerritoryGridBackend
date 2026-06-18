
const http = require('http')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')
const express = require('express') // ← ADD THIS
const cors = require('cors')       // ← ADD THIS

const prisma = new PrismaClient()
const app = express()              // ← ADD THIS
const httpServer = http.createServer(app) // ← CHANGE THIS

// ✅ ADD Express middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://territory-grid-frontend-pearl.vercel.app',
    'https://territory-grid-frontend-6pmty684-sachingithub24s-projects.vercel.app',
    'https://territory-grid-frontend-ive0uvy99-sachingithub24s-projects.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

// ✅ ADD REST API endpoint for bots
app.get('/api/bots', async (req, res) => {
  try {
    const bots = await prisma.block.findMany({
      where: { isBot: true },
      distinct: ['ownerId'],
      select: { ownerId: true }
    })
    res.json(bots.map(b => b.ownerId))
  } catch (err) {
    console.error('Error fetching bots:', err)
    res.status(500).json({ error: 'Failed to fetch bots' })
  }
})

// ✅ ADD health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://territory-grid-frontend-pearl.vercel.app',
      'https://territory-grid-frontend-6pmty684-sachingithub24s-projects.vercel.app',
      'https://territory-grid-frontend-ive0uvy99-sachingithub24s-projects.vercel.app'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

let onlineCount = 0

const GRID_SIZE = 40
const TOTAL_BLOCKS = GRID_SIZE * GRID_SIZE
const BOT_IDS = ['bot_alpha', 'bot_beta', 'bot_gamma', 'bot_delta']

io.on('connection', (socket) => {
  console.log('client connected:', socket.id)
  onlineCount++
  io.emit('online_count', onlineCount)

  // ✅ Send initial grid data
  prisma.block.findMany().then((blocks) => {
    console.log(`Sending ${blocks.length} blocks to client`)
    socket.emit('init', blocks)
  }).catch(err => {
    console.error('Error fetching blocks:', err)
    socket.emit('init', []) // Send empty array on error
  })

  socket.on('claim_block', async ({ blockId, x, y, userId }) => {
    try {
      const id = parseInt(blockId)
      
      // ✅ Check if block already exists and who owns it
      const existing = await prisma.block.findUnique({ where: { id } })
      
      if (existing && existing.ownerId && !existing.isBot) {
        // Block is owned by a real user - reject the claim
        socket.emit('block_claim_rejected', { 
          blockId: id, 
          message: 'Block already claimed by a user' 
        })
        return
      }

      const updated = await prisma.block.upsert({
        where: { id },
        update: { ownerId: userId, isBot: false },
        create: { id, x, y, ownerId: userId, isBot: false },
      })
      
      io.emit('block_updated', { 
        blockId: updated.id, 
        x: updated.x, 
        y: updated.y,
        ownerId: updated.ownerId, 
        isBot: false
      })
      
      checkAndResetIfFull()
    } catch (err) {
      console.error('upsert failed:', err)
      socket.emit('block_claim_error', { blockId, error: err.message })
    }
  })

  socket.on('disconnect', () => {
    onlineCount--
    io.emit('online_count', onlineCount)
  })
})

async function checkAndResetIfFull() {
  try {
    const count = await prisma.block.count()
    if (count >= TOTAL_BLOCKS) {
      console.log('GRID FULL — resetting all blocks!')
      await prisma.block.deleteMany({})
      io.emit('grid_reset')
      console.log('reset complete, emitted to all clients')
    }
  } catch (err) {
    console.error('reset check failed:', err)
  }
}

async function botTick() {
  try {
    const count = await prisma.block.count()
    if (count >= TOTAL_BLOCKS) {
      return
    }

    const bot = BOT_IDS[Math.floor(Math.random() * BOT_IDS.length)]
    const blockId = Math.floor(Math.random() * TOTAL_BLOCKS)
    const x = blockId % GRID_SIZE
    const y = Math.floor(blockId / GRID_SIZE)

    const existing = await prisma.block.findUnique({ where: { id: blockId } })
    
    if (existing && existing.ownerId && !existing.isBot) {
      return
    }

    const updated = await prisma.block.upsert({
      where: { id: blockId },
      update: { ownerId: bot, isBot: true },
      create: { id: blockId, x, y, ownerId: bot, isBot: true },
    })

    console.log('bot claimed block:', blockId, 'by', bot)
    io.emit('block_updated', { 
      blockId: updated.id, 
      x: updated.x,
      y: updated.y,
      ownerId: updated.ownerId, 
      isBot: true 
    })

    checkAndResetIfFull()
  } catch (err) {
    console.error('bot error:', err)
  }
}

setInterval(botTick, 800)
console.log('bot interval started')

// ✅ Use Railway's PORT
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
})