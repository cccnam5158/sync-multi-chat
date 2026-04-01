# Packet Diagram Templates

## TCP Header

```mermaid
packet-beta
    0-15: "Source Port"
    16-31: "Destination Port"
    32-63: "Sequence Number"
    64-95: "Acknowledgment Number"
    96-99: "Data Offset"
    100-102: "Reserved"
    103: "NS"
    104: "CWR"
    105: "ECE"
    106: "URG"
    107: "ACK"
    108: "PSH"
    109: "RST"
    110: "SYN"
    111: "FIN"
    112-127: "Window Size"
    128-143: "Checksum"
    144-159: "Urgent Pointer"
```

## Simple Protocol (using +N syntax)

```mermaid
packet-beta
    +8: "Version"
    +8: "Type"
    +16: "Length"
    +32: "Session ID"
    +32: "Sequence Number"
    +16: "Checksum"
    +16: "Reserved"
```

## Key Syntax

- `packet-beta` - Declaration keyword
- **Range syntax**: `0-15: "Label"` - explicit bit range
- **Auto-increment syntax**: `+16: "Label"` - spans N bits from previous end
- Both syntaxes can be mixed in one diagram
- Fields wrap to next row based on `bitsPerRow` (default 32)
- Config options: `bitsPerRow`, `showBits`, `rowHeight`, `bitWidth`
