# Audiobookshelf DSM7-ARM Porting Options

## The Problem

The original audiobookshelf uses `sqlite3` npm package, which is a **native module** requiring compilation. This fails on ARM Synology NAS devices due to:
- Missing build tools (gcc, make, python)
- Architecture mismatch (ARM vs x86_64 prebuilt binaries)
- Old glibc versions on DSM

This document compares all viable solutions.

---

## Solution Comparison Matrix

### 1. MariaDB Port
```
Code Changes ........... Major fork (rewrite all DB code)
Upstream Sync .......... ❌ Very difficult
Native Compilation ..... Not needed
External Dependencies .. MariaDB server required
Database File Format ... Different (incompatible with SQLite)
Performance ............ ⚡ Fast
Memory Usage ........... Low (Node.js), but MariaDB adds overhead
Complexity ............. High
Truly noarch ........... ✅ Yes
```

### 2. sql.js (WASM)
```
Code Changes ........... ~10 lines only
Upstream Sync .......... ✅ Easy (just merge)
Native Compilation ..... Not needed
External Dependencies .. None
Database File Format ... Same SQLite (compatible)
Performance ............ 🐢 ~30% slower than native
Memory Usage ........... High (loads entire DB into RAM)
Complexity ............. Low
Truly noarch ........... ✅ Yes
```

### 3. Cross-compile sqlite3
```
Code Changes ........... None
Upstream Sync .......... ✅ Easy
Native Compilation ..... Needed once per arch/node version
External Dependencies .. None at runtime
Database File Format ... Same SQLite
Performance ............ ⚡ Native speed
Memory Usage ........... Low
Complexity ............. Medium (toolchain setup)
Truly noarch ........... ❌ No (per-arch binary needed)
```

### 4. Build on NAS
```
Code Changes ........... None
Upstream Sync .......... ✅ Easy
Native Compilation ..... Needed on each NAS
External Dependencies .. Entware + build tools
Database File Format ... Same SQLite
Performance ............ ⚡ Native speed
Memory Usage ........... Low
Complexity ............. Medium (user must compile)
Truly noarch ........... ❌ No
```

### 5. Docker
```
Code Changes ........... None
Upstream Sync .......... ✅ Easy (pull new image)
Native Compilation ..... Not needed
External Dependencies .. Docker runtime
Database File Format ... Same SQLite
Performance ............ ⚡ Native speed
Memory Usage ........... Higher (container overhead)
Complexity ............. Medium
Truly noarch ........... ❌ No (per-arch images)
```

### 6. Build in Docker, Deploy to NAS
```
Code Changes ........... None
Upstream Sync .......... ✅ Easy
Native Compilation ..... Done once in Docker (matching NAS env)
External Dependencies .. None at runtime
Database File Format ... Same SQLite
Performance ............ ⚡ Native speed
Memory Usage ........... Low
Complexity ............. Medium (Docker build setup)
Truly noarch ........... ❌ No (per-arch binary)
```

---

## Detailed Analysis

### 1. MariaDB Port (Current Approach)

**Description:** Replace SQLite with MariaDB using pure JavaScript `mariadb` npm driver.

#### Benefits
- ✅ Pure JavaScript - no native modules at all
- ✅ Truly `noarch` - works on any CPU architecture
- ✅ Better performance than sql.js for large databases
- ✅ Supports concurrent connections natively
- ✅ MariaDB available in Synology Package Center
- ✅ Low memory footprint for the Node.js process

#### Trade-offs
- ❌ **Major code changes** - every model, query, and migration must be rewritten
- ❌ **Database format incompatible** - cannot use existing SQLite backups
- ❌ **Upstream sync nightmare** - every upstream update needs manual porting
- ❌ **External dependency** - requires MariaDB server running
- ❌ **More resource usage overall** - MariaDB itself uses memory
- ❌ **Different SQL dialects** - subtle differences between SQLite and MariaDB SQL

#### Implementation Effort
- **Initial:** ~40-80 hours (rewriting all database code)
- **Per upstream update:** ~2-10 hours depending on changes

---

### 2. sql.js with sql.js-as-sqlite3 Wrapper

**Description:** Use sql.js (SQLite compiled to WebAssembly) with a wrapper that mimics the sqlite3 npm API for Sequelize compatibility.

```javascript
// Only change needed in Database.js:
const sqlJsAsSqlite3 = require('sql.js-as-sqlite3')

this.sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: this.dbPath,
  dialectModule: sqlJsAsSqlite3,  // <-- Add this line
  // ... rest unchanged
})
```

#### Benefits
- ✅ **Minimal code changes** - only ~10 lines modified
- ✅ **Easy upstream sync** - just pull and merge, rarely conflicts
- ✅ **Same database format** - SQLite files are compatible
- ✅ **No external dependencies** - self-contained
- ✅ **Truly noarch** - WASM runs on any architecture
- ✅ **No compilation needed** - pure JS + WASM

#### Trade-offs
- ❌ **~30% slower** than native sqlite3
- ❌ **Loads entire database into memory** - problematic for large libraries
- ❌ **Memory spikes** during complex queries
- ❌ **WASM cold start** - slower initial load
- ❌ **Less mature** - sql.js-as-sqlite3 has only 362 weekly downloads
- ❌ **Potential edge cases** - not all sqlite3 features may be perfectly emulated

#### Memory Concerns
For a library with:
- 100 audiobooks: ~5-10 MB RAM - ✅ OK
- 1,000 audiobooks: ~50-100 MB RAM - ⚠️ Marginal on 512MB NAS
- 10,000 audiobooks: ~500 MB+ RAM - ❌ Too much for most ARM NAS

#### Implementation Effort
- **Initial:** ~2 hours
- **Per upstream update:** ~0-30 minutes (usually just merge)

---

### 3. Cross-Compile sqlite3 for ARM

**Description:** Build the native sqlite3.node binary targeting the NAS architecture using a cross-compilation toolchain.

#### Benefits
- ✅ **No code changes** - drop-in binary replacement
- ✅ **Native performance** - full speed
- ✅ **Low memory** - normal sqlite3 behavior
- ✅ **Easy upstream sync** - just update the binary
- ✅ **Same database format**

#### Trade-offs
- ❌ **Complex setup** - need cross-compilation toolchain
- ❌ **Per-architecture binaries** - need separate builds for armv7/aarch64
- ❌ **Per-Node-version binaries** - must match Node.js ABI
- ❌ **glibc compatibility** - must match DSM's old glibc
- ❌ **Not truly noarch** - different binary per target
- ❌ **Maintenance burden** - rebuild for each Node.js update

#### Required for Each Target
```
ARM NAS variant    + Node version  + glibc version = Unique binary
─────────────────────────────────────────────────────────────────
DS215 (armv7)      + Node 18.x     + glibc 2.20    = sqlite3-armv7-node18.node
DS220+ (aarch64)   + Node 18.x     + glibc 2.26    = sqlite3-aarch64-node18.node
DS220+ (aarch64)   + Node 20.x     + glibc 2.26    = sqlite3-aarch64-node20.node
... etc
```

#### Implementation Effort
- **Initial:** ~8-16 hours (toolchain setup + first build)
- **Per Node.js update:** ~1-2 hours
- **Per upstream update:** ~0 (just merge)

---

### 4. Build sqlite3 Directly on NAS

**Description:** Install build tools via Entware on the NAS and compile sqlite3 natively.

```bash
# On NAS via SSH:
opkg update
opkg install gcc make python3
cd /volume1/audiobookshelf
npm rebuild sqlite3
```

#### Benefits
- ✅ **No code changes**
- ✅ **Guaranteed compatibility** - built on target system
- ✅ **Native performance**
- ✅ **Easy upstream sync**

#### Trade-offs
- ❌ **Requires Entware** - extra setup for users
- ❌ **Requires build tools** - ~100MB+ disk space
- ❌ **Compilation time** - 5-15 minutes on slow ARM CPUs
- ❌ **User must rebuild** after Node.js updates
- ❌ **Not all NAS support Entware** - some older models excluded
- ❌ **Complex user instructions**

#### Implementation Effort
- **Initial:** ~2-4 hours (documentation + testing)
- **Per user installation:** ~30 minutes user time
- **Per upstream update:** ~0 (just merge)

---

### 5. Docker Container

**Description:** Run audiobookshelf in a Docker container (current official approach).

#### Benefits
- ✅ **No code changes**
- ✅ **Works everywhere Docker runs**
- ✅ **Official images maintained by upstream**
- ✅ **Easy updates** - just pull new image
- ✅ **Isolated environment**

#### Trade-offs
- ❌ **Requires Docker** - not available on all Synology models
- ❌ **Higher memory overhead** - container + app
- ❌ **More complex networking** - port mapping, volumes
- ❌ **Resource-constrained NAS struggle** - Docker itself is heavy
- ❌ **Not truly "native"** - runs in container

#### ARM NAS Docker Support
| Model | RAM | Docker Support |
|-------|-----|----------------|
| DS215j | 512MB | ❌ No |
| DS218 | 512MB | ⚠️ Barely |
| DS220+ | 2GB | ✅ Yes |
| DS920+ | 4GB | ✅ Yes |

#### Implementation Effort
- **Initial:** ~0 (already exists)
- **Per upstream update:** ~0 (pull new image)

---

### 6. Build in Docker, Deploy to NAS

**Description:** Use a Docker container that mimics the NAS environment (same ARM arch, glibc version) to compile sqlite3, then extract the binary and deploy it to the NAS for native execution (no Docker needed on NAS at runtime).

```bash
# Build sqlite3.node in Docker matching NAS environment
docker run --rm -v $(pwd):/build arm32v7/node:18-bullseye \
  sh -c "cd /build && npm rebuild sqlite3"

# Copy the compiled .node file to your package
cp node_modules/sqlite3/lib/binding/napi-v6-linux-arm/node_sqlite3.node ./prebuilt/
```

#### Benefits
- ✅ **No code changes** - drop-in binary
- ✅ **Reproducible builds** - Docker ensures consistent environment
- ✅ **No Docker needed on NAS** - just the compiled binary
- ✅ **Native performance**
- ✅ **Easy upstream sync**
- ✅ **Can match exact NAS glibc** - use appropriate base image
- ✅ **CI/CD friendly** - automate builds in GitHub Actions

#### Trade-offs
- ❌ **Per-architecture binaries** - need armv7 and aarch64 builds
- ❌ **Per-Node-version binaries** - must match Node.js ABI
- ❌ **Docker needed for build** - but only on dev machine, not NAS
- ❌ **Must find matching base image** - glibc version must be ≤ NAS version
- ❌ **Not truly noarch** - ship different binaries per target

#### Docker Base Image Selection
```
NAS Model        glibc    Recommended Docker Base Image
─────────────────────────────────────────────────────────
DS215j (armv7)   2.20     arm32v7/debian:jessie (glibc 2.19)
DS218 (armv7)    2.24     arm32v7/debian:stretch (glibc 2.24)
DS220+ (aarch64) 2.26     arm64v8/debian:buster (glibc 2.28) ⚠️
```

#### Implementation Effort
- **Initial:** ~4-8 hours (Dockerfile + build script + testing)
- **Per Node.js update:** ~30 minutes (rebuild)
- **Per upstream update:** ~0 (just merge code, rebuild binary)

---

## Recommendations

### For Maximum Compatibility (Low-end ARM NAS with 512MB RAM)
**Recommendation: sql.js** if library is small (<500 books), otherwise **Build in Docker** for native binary

### For Easiest Maintenance
**Recommendation: sql.js** - minimal code changes, easy upstream sync

### For Best Performance
**Recommendation: Build in Docker** (native binary, no runtime Docker) or **Docker** (if NAS supports it)

### For Simplest User Experience
**Recommendation: Docker** (if NAS supports it) or **Build in Docker** (ship prebuilt binary)

### For NAS Without Docker Support
**Recommendation: Build in Docker** - compile in Docker on dev machine, deploy native binary to NAS

---

## Decision Matrix by Use Case

| User Scenario | Recommended Solution |
|---------------|---------------------|
| DS215j, 512MB RAM, small library | sql.js |
| DS215j, 512MB RAM, large library | Build in Docker or MariaDB |
| DS220+, 2GB RAM | Docker (official) |
| Developer wanting upstream sync | sql.js or Build in Docker |
| Maximum performance needed | Build in Docker or Docker |
| No technical skills | Docker (GUI install) |
| NAS without Docker support | Build in Docker, deploy binary |

---

## Current Status

**Date: February 10, 2026**

### Git Branches
| Branch | Contents | Status |
|--------|----------|--------|
| `master` | Original DSM7-ARM code | Baseline |
| `pre-backport` | MariaDB port (preserved) | Archived |
| `backport` | MariaDB port (preserved) | Archived |
| `native-sqlite` | Native SQLite with prebuilt ARM binaries | ✅ **ACTIVE** |

### Current Branch: `native-sqlite`
Implements "Build in Docker, Deploy to NAS" approach (Solution #6).

### Files Created
- `Dockerfile.build-sqlite3` - Docker build environment for ARM sqlite3
- `build-sqlite3.sh` - Script to build ARM binaries in Docker
- `prebuilt/` - Directory for compiled ARM binaries (empty, needs build)
- `porting.md` - This comparison document

### Files Modified
- `build-spk.sh` - Includes prebuilt binaries in package
- `package/scripts/postinst` - Injects prebuilt binary after npm install
- `package/INFO` - Updated version to 2.0.0
- `README.md` - Updated build instructions
- `server/` - Replaced with upstream sqlite3-based code

### Next Steps (After System Restart)

```bash
# 1. Enable QEMU for ARM emulation (in WSL/Linux)
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# 2. Build sqlite3 for armv7
./build-sqlite3.sh armv7

# 3. Verify binary was created
ls -la prebuilt/

# 4. Build client (if not already built)
cd client && npm install && npm run generate && cd ..

# 5. Build SPK package
./build-spk.sh
```
