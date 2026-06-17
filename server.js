
const http = require('http')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const httpServer = http.createServer()
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3001','https://territory-grid-frontend-pearl.vercel.app/',
      'https://territory-grid-frontend-6pmty684-sachingithub24s-projects.vercel.app',], 
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

let onlineCount = 0

const GRID_SIZE = 40          // ← match frontend
const TOTAL_BLOCKS = GRID_SIZE * GRID_SIZE  // 1600
const BOT_IDS = ['bot_alpha', 'bot_beta', 'bot_gamma', 'bot_delta'] // ← match frontend

io.on('connection', (socket) => {
  console.log('client connected:', socket.id)
  onlineCount++
  io.emit('online_count', onlineCount)

  prisma.block.findMany().then((blocks) => {
    socket.emit('init', blocks)
  })

  //   //Conflicts resolution: last-write wins via Prisma upsert 
//   //Postgres processes concurrent writes sequentially - no race condition Possible
//   //The final owner is whoever's write reached the DB Last
//   //All Clients are immediately notified of the resolved state via broadcast
  // socket.on('claim_block', async ({ blockId, x, y, userId }) => {
  //   try {
  //     const id = parseInt(blockId)
  //     const updated = await prisma.block.upsert({
  //       where: { id },
  //       update: { ownerId: userId, isBot: false },
  //       create: { id, x, y, ownerId: userId, isBot: false },
  //     })
  //     io.emit('block_updated', { blockId: updated.id, ownerId: updated.ownerId })
      
  //     // Check if grid is full after this claim
  //     checkAndResetIfFull()
  //   } catch (err) {
  //     console.error('upsert failed:', err)
  //   }
  // })


  socket.on('claim_block', async ({ blockId, x, y, userId }) => {
  try {
    const id = parseInt(blockId)
    const updated = await prisma.block.upsert({
      where: { id },
      update: { ownerId: userId, isBot: false },
      create: { id, x, y, ownerId: userId, isBot: false },
    })
    
    // FIXED: Consistent payload shape including x, y, and explicit isBot
    io.emit('block_updated', { 
      blockId: updated.id, 
      x: updated.x, 
      y: updated.y,
      ownerId: updated.ownerId, 
      isBot: false  // ← explicit, not undefined
    })
    
    checkAndResetIfFull()
  } catch (err) {
    console.error('upsert failed:', err)
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
      
      // CRITICAL: Delete FIRST, then emit
      await prisma.block.deleteMany({})
      
      // Emit AFTER database is cleared
      io.emit('grid_reset')
      
      console.log('reset complete, emitted to all clients')
    }
  } catch (err) {
    console.error('reset check failed:', err)
  }
}

async function botTick() {
  try {
    // Check if grid is full before bot claims
    const count = await prisma.block.count()
    if (count >= TOTAL_BLOCKS) {
      console.log('bot tick: grid full, skipping')
      return
    }

    const bot = BOT_IDS[Math.floor(Math.random() * BOT_IDS.length)]
    const blockId = Math.floor(Math.random() * TOTAL_BLOCKS)  // ← 1600, not 400
    const x = blockId % GRID_SIZE                             // ← 40, not 20
    const y = Math.floor(blockId / GRID_SIZE)                 // ← 40, not 20

    const existing = await prisma.block.findUnique({ where: { id: blockId } })
    
    if (existing && existing.ownerId && !existing.isBot) {
      console.log('skipping block', blockId, '- owned by real user')
      return
    }

    const updated = await prisma.block.upsert({
      where: { id: blockId },
      update: { ownerId: bot, isBot: true },
      create: { id: blockId, x, y, ownerId: bot, isBot: true },
    })

    console.log('bot claimed block:', blockId, 'by', bot)
    io.emit('block_updated', { blockId: updated.id, ownerId: updated.ownerId, isBot: true })

    // Check if this bot claim filled the grid
    checkAndResetIfFull()

  } catch (err) {
    console.error('bot error:', err)
  }
}

setInterval(botTick, 800)
console.log('bot interval started')

httpServer.listen(3001, () => {
  console.log('socket server running on 3001')
})
