/**
 * GitHub Webhooks API - Handle incoming webhook events
 *
 * POST /api/github/webhooks - Process GitHub webhook events
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('GitHub webhook secret not configured');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || '';
    const event = request.headers.get('x-github-event') || '';
    const deliveryId = request.headers.get('x-github-delivery') || '';

    // Verify signature
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const data = JSON.parse(payload);

    // Handle different event types
    switch (event) {
      case 'push':
        await handlePushEvent(data);
        break;

      case 'ping':
        // GitHub sends ping when webhook is first set up
        return NextResponse.json({ message: 'pong' });

      case 'create':
        await handleCreateEvent(data);
        break;

      case 'delete':
        await handleDeleteEvent(data);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return NextResponse.json({
      success: true,
      event,
      deliveryId,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle push events - new commits pushed to repository
 */
async function handlePushEvent(data: {
  repository: { full_name: string };
  ref: string;
  commits: Array<{
    id: string;
    message: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  head_commit: { id: string } | null;
}) {
  const { repository, ref, commits, head_commit } = data;

  // Extract branch name from ref (refs/heads/main -> main)
  const branch = ref.replace('refs/heads/', '');

  // Find linked repository
  const [owner, repo] = repository.full_name.split('/');
  const linkedRepo = await db.gitHubRepository.findFirst({
    where: {
      owner,
      repo,
      branch,
    },
  });

  if (!linkedRepo) {
    console.log(`No linked project for ${repository.full_name}:${branch}`);
    return;
  }

  // Collect all changed files
  const changedFiles = new Set<string>();
  for (const commit of commits) {
    commit.added.forEach(f => changedFiles.add(f));
    commit.modified.forEach(f => changedFiles.add(f));
    commit.removed.forEach(f => changedFiles.add(f));
  }

  // Update repository status to indicate pending sync
  await db.gitHubRepository.update({
    where: { id: linkedRepo.id },
    data: {
      syncStatus: 'SYNCING',
      lastCommitSha: head_commit?.id || linkedRepo.lastCommitSha,
    },
  });

  console.log(`Push event for ${repository.full_name}:${branch} - ${changedFiles.size} files changed`);
}

/**
 * Handle create events - new branch or tag created
 */
async function handleCreateEvent(data: {
  repository: { full_name: string };
  ref_type: string;
  ref: string;
}) {
  const { repository, ref_type, ref } = data;
  console.log(`Create event: ${ref_type} '${ref}' in ${repository.full_name}`);
}

/**
 * Handle delete events - branch or tag deleted
 */
async function handleDeleteEvent(data: {
  repository: { full_name: string };
  ref_type: string;
  ref: string;
}) {
  const { repository, ref_type, ref } = data;

  if (ref_type === 'branch') {
    // Check if any linked repos use this branch
    const [owner, repo] = repository.full_name.split('/');
    const linkedRepos = await db.gitHubRepository.findMany({
      where: {
        owner,
        repo,
        branch: ref,
      },
    });

    // Mark linked repos as having sync error
    for (const linkedRepo of linkedRepos) {
      await db.gitHubRepository.update({
        where: { id: linkedRepo.id },
        data: {
          syncStatus: 'ERROR',
        },
      });
    }
  }

  console.log(`Delete event: ${ref_type} '${ref}' in ${repository.full_name}`);
}
