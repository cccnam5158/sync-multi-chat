# Timeline Templates

## Basic Timeline

```mermaid
timeline
    title History of Social Media
    2002 : LinkedIn
    2004 : Facebook
         : Google
    2005 : YouTube
    2006 : Twitter
    2010 : Instagram
         : Pinterest
    2016 : TikTok
```

## Timeline with Sections

```mermaid
timeline
    title Company Milestones
    section Foundation
        2020 : Company founded
             : First prototype
        2021 : Seed funding
             : MVP launched
    section Growth
        2022 : Series A
             : 10K users
             : Hired first team
        2023 : International expansion
             : 100K users
    section Scale
        2024 : Series B
             : Enterprise product
             : 1M users
```

## Key Syntax

- `timeline` - Declaration keyword
- `title Title Text` - Diagram title
- `section Section Name` - Groups time periods into named sections
- `Time Period : Event` - A time period with one event
- `Time Period : Event1 : Event2` - Multiple events on one line
- Stacked events: indent with spaces and use `: Event` on next lines
