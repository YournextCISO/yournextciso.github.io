---
title: "Wazuh SIEM Deployment — From Zero to Operational"
date: 2026-07-18
tags: ["Wazuh", "SIEM", "Detection", "Lab", "Open Source"]
excerpt: "A step-by-step guide to deploying Wazuh SIEM on a single node, configuring agents, writing custom detection rules, and setting up alerts."
---

## Why Wazuh?

Wazuh is a free, open-source Security Information and Event Management (SIEM) and Extended Detection and Response (XDR) platform. It's used by organizations of all sizes for:

- Log data analysis
- File integrity monitoring (FIM)
- Vulnerability detection
- Configuration assessment
- Incident response
- Regulatory compliance (PCI DSS, HIPAA, GDPR)

## Architecture Overview

The Wazuh platform consists of three main components:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Wazuh Agent │────▶│ Wazuh Server │────▶│ Wazuh Indexer│
│  (endpoints) │     │  (manager)   │     │(Elasticsearch)│
└──────────────┘     └──────────────┘     └──────────────┘
```

- **Wazuh Agent** — Installed on endpoints, collects logs and sends telemetry
- **Wazuh Server** — Analyzes data, triggers alerts, manages agents
- **Wazuh Indexer** — Stores and indexes data (based on OpenSearch/Elasticsearch)
- **Wazuh Dashboard** — Web UI for visualization and management

## Step 1: Install the Wazuh Server

On Ubuntu 22.04:

```bash
# Download the quickstart script
curl -sO https://packages.wazuh.com/4.7/wazuh-install.sh
curl -sO https://packages.wazuh.com/4.7/config.yml

# Run the installation
sudo bash wazuh-install.sh --generate-config-files
sudo bash wazuh-install.sh --wazuh-indexer node-1
sudo bash wazuh-install.sh --start-cluster
sudo bash wazuh-install.sh --wazuh-server wazuh-1
sudo bash wazuh-install.sh --wazuh-dashboard dashboard
```

> **Note:** Save all generated passwords! They'll be displayed at the end of the installation.

## Step 2: Custom Detection Rules

Create a custom rule file at `/var/ossec/etc/rules/local_rules.xml`:

```xml
<group name="custom,sysmon">
  <rule id="100001" level="12">
    <if_sid>61650</if_sid>
    <field name="win.eventdata.commandLine" type="pcre2">mimikatz</field>
    <description>Mimikatz execution detected</description>
    <mitre>
      <id>T1003</id>
    </mitre>
  </rule>
</group>
```

This rule triggers on **level 12** (high severity) whenever Mimikatz is executed on any monitored endpoint.

## Step 3: Deploy Agents

On each Windows/Linux endpoint:

```bash
# Linux agent
curl -s https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/wazuh-agent_4.7.0-1_amd64.deb -o wazuh-agent.deb
sudo WAZUH_MANAGER='10.0.0.10' dpkg -i ./wazuh-agent.deb
sudo systemctl start wazuh-agent
```

For Windows, use the MSI installer with the `WAZUH_MANAGER` parameter pointing to your server.

## Step 4: Verify and Tune

```bash
# Check agent status
sudo /var/ossec/bin/agent_control -l

# Test rule triggering
sudo /var/ossec/bin/wazuh-logtest
```

## Pro Tips

- Start with the default ruleset and **tune before you customize**
- Use `sysmon` on Windows endpoints for rich event data
- Set up **email/Slack alerts** for high-severity rules
- Schedule regular **agent health checks**

---

*This is part of my Wazuh Lab Series — check the GitHub repo for more advanced configurations.*