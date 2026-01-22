---
layout: post
title: "KeyleSSH: A PAM With No Single Point of Vulnerability"
---

Infrastructure security is built on a paradox: to protect your assets, you must create a catastrophic single point of vulnerability - a vault, a Certificate Authority, or a database that holds the keys to everything. The US Treasury Department <a href="https://www.bleepingcomputer.com/news/security/postgresql-flaw-exploited-as-zero-day-in-beyondtrust-breach/">learnt that lesson</a> the hard way when they put their trust in a single vendor last year.
The industry's answer has always been "a safer box": bastion hosts, PAM vaults, rotation policies. But a key stored anywhere is a key exposed somewhere. We call this the key-under-mat problem.
Our senior dev at Tide, Sasha, spent a few weekends trying a new PAM approach that eliminates both the key and the mat. No key left to secure or rotate, also leaves nothing to steal and zero admin overhead.
She built and open sourced the PoC, KeyleSSH, a browser-based SSH console that replaces the centralized vault with a decentralized secrets manager.

# The Architecture: Ineffable Cryptography

KeyleSSH utilizes the <strong>Tide Cybersecurity Fabric</strong>, a network of nodes (ORKs) that operate on secrets without ever seeing them. This is based on a framework we call "Ineffable Cryptography" - A cryptographic scheme where secrets that are never expressed in whole, therefore can never be lost, stolen or misused.<br>
    Traditional Multi-Party Computation (MPC), used by advanced vaults to operate on split keys, still momentarily combines the pieces inside a Trusted Execution Environment (TEE). The protocols behind Ineffable Cryptography, however, remain entirely blind from start to end. <strong>The key is never reconstructed, not even in a TEE</strong>. A signature, decryption or other key action is mathematically constructed directly from the distributed shares performing partial operations.
Instead of a server holding an SSH private key and signing user requests, the signing operation itself is distributed:
- <strong>Authentication</strong>: The user performs Zero-Knowledge authentication via OIDC (via TideCloak IAM), receiving a token bound to their device and session.
- <strong>Request</strong>: KeyleSSH constructs a signing request containing the raw SSH challenge bytes and human-readable metadata.
- <strong>Consensus</strong>: The request is sent to the decentralized Fabric. Nodes independently validate the policy (e.g., "Is User A allowed to access Server B?").
- <strong>Threshold Signing</strong>: If the policy passes, nodes generate partial signatures using Tide's special MPC. These are combined to form a valid Ed25519 signature.

Crucially, the private key is never reassembled. Even if you compromised a node in the fabric, you would find only mathematical noise. To compromise a single key, you would need to compromise a majority of nodes simultaneously.

<em>The underlying protocol has been formally analyzed over 7 years of academic research. </em><a href="https://arxiv.org/abs/2309.00915"><em>Read one of the cryptographic proofs here</em></a><em>.</em>

# The Implementation: 30 Lines of Code

Proper key management is notoriously difficult to implement. When used as part of a cryptographic protocol, like SSH, it usually requires specialized cryptography teams and complex state management. With KeyleSSH, none of that is necessary.
What makes KeyleSSH interesting is that Sasha built the core proof-of-concept in only few weekends using the <a href="https://docs.tidecloak.com/">TideCloak SDK</a>. The SDK abstracts the complex orchestration of the decentralized network and the key lifecycle management into a standard async interface.
This is the actual code that replaces the entire "secure vault" backend of a traditional PAM:

_client/src/lib/tideSsh.ts_
```typescript
import { IAMService } from "@tidecloak/js";
import { TideMemory, BaseTideRequest } from "heimdall-tide";

export function createTideSshSigner(): SSHSigner {
 return async (req: SSHSignatureRequest) =&gt; {
   const tc = (IAMService as any)._tc;

   // 1. Pack the data (Metadata + SSH Challenge)
   const humanReadable = createHumanReadableInfo(req);
   const draft = TideMemory.CreateFromArray([humanReadable, req.data]);

   // 2. Construct the Request for the Fabric
   const tideRequest = new BaseTideRequest(
     "BasicCustom", // Protocol
     "BasicCustom&lt;1&gt;",   // Version
     "Policy:1",         // The policy contract to execute
     draft,
     new TideMemory()
   );

   // 3. Attach Authorizer (The user's doken)
   const dokenBytes = new TextEncoder().encode(tc.doken);
   tideRequest.addAuthorizer(TideMemory.CreateFromArray([dokenBytes]));

   // 4. Execute Distributed Signing
   // The SDK handles the communication with the ORK nodes.
   const initialized = await tc.createTideRequest(tideRequest.encode());
   const sigs = await tc.executeSignRequest(initialized, true);

   return sigs[0]; // The valid Ed25519 signature.
 };
}
```

This snippet achieves something that previously required expensive hardware modules (HSMs) or high-risk software vaults: generating a valid signature without the signing key ever being present in memory.

# The Demise of the Rogue Admin

Because the authority over assets now live in the network, away from the PAM and anyone administering it, we can enforce logic that even a root admin cannot bypass. For example, a policy can require M-of-N signatures from other admins before granting access to a production cluster.

Unlike application-layer logic (which can be patched out by a rogue admin), this approach is a constraint enforced by the signing network itself. If the quorum isn't met, the mathematical threshold for the signature is never reached.
## Current Limitations & Alpha Status

While the architectural model offers significant advantages over centralized PAMs, KeyleSSH is currently a proof-of-concept.

- <strong>Browser Security</strong>: The client runs in a browser. While we use Subresource Integrity (SRI), a compromised endpoint device (malware on the admin's laptop) remains a threat vector.
- <strong>Centralization of the Testnet</strong>: Currently, the Tide ORK nodes are operated primarily by the Tide test network. We are working toward a fully decentralized mainnet, but today, trust is still placed in the Tide infrastructure providers.
- <strong>Host Hardening</strong>: As with any PAM, this solution solves the authentication problem. It does not replace the need for standard OS-level controls, patching, or network segmentation.

# Summary

KeyleSSH demonstrates what's possible beyond the "trusted vault" era. By pushing state and authority to a decentralized fabric, we eliminate the Single Point of Failure that plagues modern infrastructure. It doesn't eliminate every security risk, but it does eliminate the "central trust" blast radius that underpins traditional security stacks.

## Links

Source Code: <a href="https://github.com/sashyo/keylessh/" target="_blank">github.com/sashyo/keylessh</a><br>
Live Demo: <a href="https://demo.keylessh.com/" target="_blank">demo.keylessh.com</a><br>
TideCloak SDK: <a href="https://docs.tidecloak.com" target="_blank">docs.tidecloak.com</a>
