import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { publishPostDirectly } from '@/lib/publishPostDirect'
import { sendMail } from '@/utils/mail'
import { redis } from '@/utils/redis'
import { buildMaintenanceEmail } from '@/utils/maintenanceMail'

const cronLockKey = 'cron:zyvarin:lock'
const maintenanceCacheKey = 'cache:maintenance:active'


async function checkCronTime() {
  const now = new Date()
  const minutes = now.getMinutes()
  const hours = now.getHours()
  const subject = `Cron Job Executed at ${now.toISOString()}`
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Cron Job Execution Report</h2>
      <p style="font-size: 16px; color: #555;">The cron job was executed at <strong>${now.toLocaleString()}</strong>.</p>
      <p style="font-size: 16px; color: #555;">Current Server Time: ${now.toLocaleString()}</p>
      <p style="font-size: 16px; color: #555;">Minutes: ${minutes}</p>
      <p style="font-size: 16px; color: #555;">Hours: ${hours}</p>
      <p style="font-size: 16px; color: #555;">This is a test email to verify that the cron job is running correctly.</p>
    </div>
  `
  await sendMail({
    to: process.env.ADMIN_EMAIL || '',
    subject,
    htmlContent
  })


  return {
    success: true,
  }


}



async function handlePendingTransactions() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const failedTransactions = await prisma.transaction.updateMany({
    where: {
      status: 'PENDING',
      createdAt: {
        lt: oneDayAgo
      }
    },
    data: {
      status: 'FAILED',
      updatedAt: new Date()
    }
  })

  if (failedTransactions.count > 0) {
    const transactions = await prisma.transaction.findMany({
      where: {
        status: 'FAILED',
        updatedAt: {
          gte: oneDayAgo
        }
      },
      include: {
        user: true
      }
    })

    for (const transaction of transactions) {
      await prisma.notification.create({
        data: {
          userId: transaction.user.id,
          senderType: 'SYSTEM',
          title: '❌ Transaction Failed',
          message: `Your transaction(₹${transaction.amount}) could not be processed.Please try again or contact support.`,
          isRead: false
        }
      })
    }
  }

  return {
    failedCount: failedTransactions.count,
    timestamp: new Date().toISOString()
  }
}

async function handlePendingInvoices() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      paymentStatus: 'PENDING',
      createdAt: {
        lt: oneDayAgo
      }
    },
    include: {
      user: true
    }
  })

  let failedCount = 0

  for (const invoice of overdueInvoices) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paymentStatus: 'FAILED',
        updatedAt: new Date()
      }
    })

    await prisma.notification.create({
      data: {
        userId: invoice.user.id,
        senderType: 'SYSTEM',
        title: '❌ Invoice Payment Failed',
        message: `Invoice #${invoice.id.slice(0, 8)} for ₹${invoice.totalAmount} has expired.Please generate a new payment link.`,
        isRead: false
      }
    })

    failedCount++
  }

  return {
    failedCount: failedCount,
    timestamp: new Date().toISOString()
  }
}

async function handleSubscriptionExpiry() {
  const { sendMail } = await import('@/utils/mail')
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const usersExpiringIn7Days = await prisma.user.findMany({
    where: {
      subscription_plan: { in: ['CREATOR', 'PREMIUM'] },
      subscription_status: 'ACTIVE',
      next_billing_date: {
        gte: new Date(sevenDaysFromNow.getFullYear(), sevenDaysFromNow.getMonth(), sevenDaysFromNow.getDate(), 0, 0, 0),
        lte: new Date(sevenDaysFromNow.getFullYear(), sevenDaysFromNow.getMonth(), sevenDaysFromNow.getDate(), 23, 59, 59)
      }
    }
  })

  let remindersSent = 0
  for (const user of usersExpiringIn7Days) {
    try {
      await sendMail({
        to: user.email,
        subject: '⏰ Your Zyvarin Subscription Expires in 7 Days',
        htmlContent: `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;" >
      <h2 style="color: #333;" > Hi ${user.fullName}, </h2>
        < p style = "font-size: 16px; color: #555;" > Your < strong > ${user.subscription_plan} </> plan will expire on <strong>${user.next_billing_date?.toLocaleDateString()}</strong >.</p>
          < p style = "font-size: 16px; color: #555;" > To continue enjoying premium features, please renew your subscription before the expiry date.</>
            < p style = "font-size: 16px; color: #555;" > If you don't renew, your account will be automatically downgraded to the FREE plan.</>
              < div style = "margin: 30px 0;" >
                <a href="${process.env.NEXTAUTH_URL}/dashboard/billing" style = "background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;" > Renew Now </a>
                  </>
                  < p style = "font-size: 14px; color: #888;" > Thank you for using Zyvarin!</>
                    </div>
                      `
      })

      await prisma.notification.create({
        data: {
          userId: user.id,
          senderType: 'SYSTEM',
          title: '⏰ Subscription Expiring Soon',
          message: `Your ${user.subscription_plan} plan expires in 7 days.Renew now to keep your premium features.`,
          isRead: false
        }
      })

      remindersSent++
    } catch (error) {
      console.error(`Failed to send expiry reminder to ${user.email}: `, error)
    }
  }

  const usersExpiredToday = await prisma.user.findMany({
    where: {
      subscription_plan: { in: ['CREATOR', 'PREMIUM'] },
      subscription_status: 'ACTIVE',
      next_billing_date: {
        lte: now
      }
    }
  })

  let downgradedCount = 0
  for (const user of usersExpiredToday) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscription_plan: 'FREE',
          subscription_status: 'INACTIVE',
          next_billing_date: null,
          updatedAt: new Date()
        }
      })

      await sendMail({
        to: user.email,
        subject: '📉 Your Zyvarin Subscription Has Expired',
        htmlContent: `
    < div style = "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;" >
      <h2 style="color: #333;" > Hi ${user.fullName}, </h2>
        < p style = "font-size: 16px; color: #555;" > Your < strong > ${user.subscription_plan} </> plan has expired and your account has been downgraded to the <strong>FREE</strong > plan.</p>
          < p style = "font-size: 16px; color: #555;" > You can still access basic features, but premium capabilities are now limited.</>
            < p style = "font-size: 16px; color: #555;" > Want to regain full access ? Upgrade anytime! </>
              < div style = "margin: 30px 0;" >
                <a href="${process.env.NEXTAUTH_URL}/pricing" style = "background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;" > View Plans </a>
                  </>
                  < p style = "font-size: 14px; color: #888;" > Thank you for using Zyvarin!</>
                    </div>
                      `
      })

      await prisma.notification.create({
        data: {
          userId: user.id,
          senderType: 'SYSTEM',
          title: '📉 Subscription Expired',
          message: `Your subscription has expired.Your account has been downgraded to FREE plan.Upgrade anytime to restore premium features.`,
          isRead: false
        }
      })

      downgradedCount++
    } catch (error) {
      console.error(`Failed to downgrade user ${user.email}: `, error)
    }
  }

  return {
    remindersSent,
    downgradedCount,
    timestamp: new Date().toISOString()
  }
}

async function handleMaintenanceWindows() {
  const now = new Date()

  const startingMaintenances = await prisma.maintenance.findMany({
    where: {
      status: 'SCHEDULED',
      startsAt: {
        lte: now
      }
    }
  })

  const completedMaintenances = await prisma.maintenance.findMany({
    where: {
      status: 'ONGOING',
      endsAt: {
        lte: now
      }
    }
  })

  if (startingMaintenances.length > 0 || completedMaintenances.length > 0) {
    await redis.del(maintenanceCacheKey)
  }

  const users = await prisma.user.findMany({
    select: { email: true }
  })

  for (const maintenance of startingMaintenances) {
    await prisma.maintenance.update({
      where: { id: maintenance.id },
      data: { status: 'ONGOING' }
    })

    const email = buildMaintenanceEmail({
      type: 'started',
      title: maintenance.title,
      message: maintenance.message,
      startsAt: maintenance.startsAt,
      endsAt: maintenance.endsAt,
      baseUrl: process.env.NEXTAUTH_URL || ''
    })

    await Promise.all(
      users.map(user =>
        sendMail({
          to: user.email,
          subject: email.subject,
          htmlContent: email.htmlContent
        }).catch(() => null)
      )
    )
  }

  for (const maintenance of completedMaintenances) {
    await prisma.maintenance.update({
      where: { id: maintenance.id },
      data: { status: 'COMPLETED' }
    })

    const email = buildMaintenanceEmail({
      type: 'completed',
      title: maintenance.title,
      message: maintenance.message,
      startsAt: maintenance.startsAt,
      endsAt: maintenance.endsAt,
      baseUrl: process.env.NEXTAUTH_URL || ''
    })

    await Promise.all(
      users.map(user =>
        sendMail({
          to: user.email,
          subject: email.subject,
          htmlContent: email.htmlContent
        }).catch(() => null)
      )
    )
  }

  return {
    started: startingMaintenances.length,
    completed: completedMaintenances.length,
    timestamp: new Date().toISOString()
  }
}



export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret} `) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await checkCronTime().catch(error => {
      console.error('Cron test email failed:', error)
    })

    const lock = await redis.setnx(cronLockKey, new Date().toISOString())
    if (!lock) {
      return NextResponse.json({ success: true, skipped: true, message: 'Cron already running' })
    }
    await redis.expire(cronLockKey, 1500)

    const now = new Date()

    const scheduledPosts = await prisma.post.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: {
          lte: now
        }
      },
      include: {
        socialProvider: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        }
      }
    })

    const results = {
      success: 0,
      failed: 0,
      details: [] as any[]
    }

    for (const post of scheduledPosts) {
      try {
        const platform = post.socialProvider.provider
        const result = await publishPostDirectly(post.id)

        if (result.success) {
          await prisma.notification.create({
            data: {
              userId: post.socialProvider.user.id,
              senderType: 'SYSTEM',
              title: '✅ Post Published Successfully',
              message: `Your scheduled post was published to ${platform} `,
              isRead: false
            }
          })

          results.success++
          results.details.push({
            postId: post.id,
            platform: platform,
            status: 'success'
          })
        } else {
          await prisma.post.update({
            where: { id: post.id },
            data: {
              status: 'FAILED',
              errorMessage: result.error || 'Unknown error'
            }
          })

          await prisma.notification.create({
            data: {
              userId: post.socialProvider.user.id,
              senderType: 'SYSTEM',
              title: '❌ Post Publishing Failed',
              message: `Failed to publish your scheduled post to ${platform} `,
              isRead: false
            }
          })

          results.failed++
          results.details.push({
            postId: post.id,
            platform: platform,
            status: 'failed',
            error: result.error
          })
        }
      } catch (error: any) {
        console.error(`Error processing post ${post.id}: `, error.message)

        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: 'FAILED',
            errorMessage: error.message || 'Unknown error'
          }
        })

        await prisma.notification.create({
          data: {
            userId: post.socialProvider.user.id,
            senderType: 'SYSTEM',
            title: '❌ Post Publishing Error',
            message: `An error occurred while publishing your post`,
            isRead: false
          }
        })

        results.failed++
        results.details.push({
          postId: post.id,
          platform: post.socialProvider.provider,
          status: 'error',
          error: error.message
        })
      }
    }

    const maintenanceResults = await handleMaintenanceWindows()
    const transactionResults = await handlePendingTransactions()
    const invoiceResults = await handlePendingInvoices()
    const subscriptionResults = await handleSubscriptionExpiry()

    return NextResponse.json({
      success: true,
      jobs: {
        scheduledPosts: {
          processed: scheduledPosts.length,
          results
        },
        transactions: transactionResults,
        invoices: invoiceResults,
        subscriptions: subscriptionResults,
        maintenance: maintenanceResults
      },
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process scheduled posts' },
      { status: 500 }
    )
  } finally {
    await redis.del(cronLockKey)
  }
}

