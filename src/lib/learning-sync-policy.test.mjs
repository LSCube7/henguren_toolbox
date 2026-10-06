import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextSyncAt,retrySyncDelay,canRetrySync} from './learning-sync-policy.ts';
test('debounces changes while bounding continuous learning to one minute',()=>{assert.equal(nextSyncAt(true,20000,10000,0),30000);assert.equal(nextSyncAt(true,69000,10000,0),70000);});
test('clean partitions check every five minutes',()=>{assert.equal(nextSyncAt(false,0,0,1234),301234);});
test('retry backoff is bounded with jitter',()=>{assert.equal(retrySyncDelay(0,1),15000);assert.equal(retrySyncDelay(1,1),30000);assert.equal(retrySyncDelay(20,1),300000);assert.equal(retrySyncDelay(20,0),240000);});
test('pauses authentication and invalid data but retries transient failures',()=>{for(const code of ['UNAUTHORIZED','INVALID_MASTERY','SNAPSHOT_TOO_LARGE','LOCAL_APPLY_FAILED','TARGET_CHANGED'])assert.equal(canRetrySync(code),false);for(const code of ['NETWORK_ERROR','SYNC_BUSY','SYNC_CONFLICT','BACKUP_FAILED'])assert.equal(canRetrySync(code),true);});
