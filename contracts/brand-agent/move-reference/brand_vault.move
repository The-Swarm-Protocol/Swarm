module brandmover::brand_vault {
    use std::signer;
    use std::vector;
    use std::string::String;
    use aptos_framework::timestamp;
    use aptos_framework::event;

    // ============================================================
    // ERROR CODES
    // ============================================================
    const E_NOT_OWNER: u64 = 1;
    const E_VAULT_EXISTS: u64 = 2;
    const E_VAULT_NOT_FOUND: u64 = 3;
    const E_NOT_AUTHORIZED: u64 = 4;
    const E_AGENT_NOT_SET: u64 = 5;

    // ============================================================
    // RESOURCES
    // ============================================================

    /// Core brand vault — stores ENCRYPTED brand guidelines
    struct BrandVault has key {
        encrypted_guidelines: vector<u8>,
        guidelines_hash: vector<u8>,
        brand_name: String,
        owner: address,
        agent_address: address,
        authorized_readers: vector<address>,
        campaign_count: u64,
        last_updated: u64,
    }

    /// A campaign with full launch metadata
    struct Campaign has key, store, drop, copy {
        id: u64,
        content_hash: vector<u8>,
        platforms: String,
        name: String,
        campaign_type: String,       // "full_launch", "remarketing", "pr_only"
        content_types: String,       // "pr,twitter,linkedin,discord,instagram,video,email"
        created_by: address,
        created_at: u64,
        status: u8,                  // 0=draft, 1=active, 2=complete, 3=scheduled
    }

    /// Stores all campaigns for a brand
    struct CampaignRegistry has key {
        campaigns: vector<Campaign>,
    }

    /// Scheduled remarketing content
    struct ScheduledContent has key {
        entries: vector<ScheduleEntry>,
    }

    struct ScheduleEntry has store, drop, copy {
        campaign_id: u64,
        content_hash: vector<u8>,
        platforms: String,
        schedule_type: String,       // "remarketing_7d", "remarketing_14d", "followup"
        scheduled_for: u64,          // unix timestamp for when to execute
        created_at: u64,
        executed: bool,
    }

    /// Activity log for the AI agent
    struct AgentActivityLog has key {
        entries: vector<ActivityEntry>,
    }

    struct ActivityEntry has store, drop, copy {
        action_type: String,
        description: String,
        data_hash: vector<u8>,
        timestamp: u64,
    }

    // ============================================================
    // EVENTS
    // ============================================================

    #[event]
    struct VaultCreatedEvent has drop, store {
        owner: address,
        brand_name: String,
        timestamp: u64,
    }

    #[event]
    struct CampaignCreatedEvent has drop, store {
        campaign_id: u64,
        name: String,
        campaign_type: String,
        content_types: String,
        created_by: address,
        platforms: String,
        timestamp: u64,
    }

    #[event]
    struct ContentScheduledEvent has drop, store {
        campaign_id: u64,
        schedule_type: String,
        scheduled_for: u64,
        platforms: String,
        timestamp: u64,
    }

    #[event]
    struct AgentActivityEvent has drop, store {
        agent: address,
        action_type: String,
        data_hash: vector<u8>,
        timestamp: u64,
    }

    // ============================================================
    // PUBLIC ENTRY FUNCTIONS
    // ============================================================

    /// Initialize a new brand vault with encrypted guidelines
    public entry fun initialize_vault(
        owner: &signer,
        brand_name: String,
        encrypted_guidelines: vector<u8>,
        guidelines_hash: vector<u8>,
        agent_address: address,
    ) {
        let owner_addr = signer::address_of(owner);
        assert!(!exists<BrandVault>(owner_addr), E_VAULT_EXISTS);

        let now = timestamp::now_seconds();

        move_to(owner, BrandVault {
            encrypted_guidelines,
            guidelines_hash,
            brand_name,
            owner: owner_addr,
            agent_address,
            authorized_readers: vector::empty<address>(),
            campaign_count: 0,
            last_updated: now,
        });

        move_to(owner, CampaignRegistry {
            campaigns: vector::empty<Campaign>(),
        });

        move_to(owner, ScheduledContent {
            entries: vector::empty<ScheduleEntry>(),
        });

        move_to(owner, AgentActivityLog {
            entries: vector::empty<ActivityEntry>(),
        });

        event::emit(VaultCreatedEvent {
            owner: owner_addr,
            brand_name,
            timestamp: now,
        });
    }

    /// Update encrypted guidelines — OWNER ONLY
    public entry fun update_guidelines(
        owner: &signer,
        new_encrypted_guidelines: vector<u8>,
        new_guidelines_hash: vector<u8>,
    ) acquires BrandVault {
        let owner_addr = signer::address_of(owner);
        assert!(exists<BrandVault>(owner_addr), E_VAULT_NOT_FOUND);
        let vault = borrow_global_mut<BrandVault>(owner_addr);
        assert!(vault.owner == owner_addr, E_NOT_OWNER);

        vault.encrypted_guidelines = new_encrypted_guidelines;
        vault.guidelines_hash = new_guidelines_hash;
        vault.last_updated = timestamp::now_seconds();
    }

    /// Add authorized reader — OWNER ONLY
    public entry fun add_reader(
        owner: &signer,
        reader_address: address,
    ) acquires BrandVault {
        let owner_addr = signer::address_of(owner);
        let vault = borrow_global_mut<BrandVault>(owner_addr);
        assert!(vault.owner == owner_addr, E_NOT_OWNER);
        vector::push_back(&mut vault.authorized_readers, reader_address);
    }

    /// Set AI agent address — OWNER ONLY
    public entry fun set_agent(
        owner: &signer,
        new_agent_address: address,
    ) acquires BrandVault {
        let owner_addr = signer::address_of(owner);
        let vault = borrow_global_mut<BrandVault>(owner_addr);
        assert!(vault.owner == owner_addr, E_NOT_OWNER);
        vault.agent_address = new_agent_address;
    }

    /// Create a full campaign — OWNER or AGENT only
    public entry fun create_campaign(
        caller: &signer,
        vault_owner: address,
        name: String,
        content_hash: vector<u8>,
        platforms: String,
        campaign_type: String,
        content_types: String,
    ) acquires BrandVault, CampaignRegistry {
        let caller_addr = signer::address_of(caller);
        let vault = borrow_global_mut<BrandVault>(vault_owner);
        assert!(
            caller_addr == vault.owner || caller_addr == vault.agent_address,
            E_NOT_AUTHORIZED
        );

        let now = timestamp::now_seconds();
        let campaign_id = vault.campaign_count;
        vault.campaign_count = campaign_id + 1;

        let campaign = Campaign {
            id: campaign_id,
            content_hash,
            platforms,
            name,
            campaign_type,
            content_types,
            created_by: caller_addr,
            created_at: now,
            status: 1,
        };

        let registry = borrow_global_mut<CampaignRegistry>(vault_owner);
        vector::push_back(&mut registry.campaigns, campaign);

        event::emit(CampaignCreatedEvent {
            campaign_id,
            name,
            campaign_type,
            content_types,
            created_by: caller_addr,
            platforms,
            timestamp: now,
        });
    }

    /// Schedule remarketing content — OWNER or AGENT only
    public entry fun schedule_content(
        caller: &signer,
        vault_owner: address,
        campaign_id: u64,
        content_hash: vector<u8>,
        platforms: String,
        schedule_type: String,
        scheduled_for: u64,
    ) acquires BrandVault, ScheduledContent {
        let caller_addr = signer::address_of(caller);
        let vault = borrow_global<BrandVault>(vault_owner);
        assert!(
            caller_addr == vault.owner || caller_addr == vault.agent_address,
            E_NOT_AUTHORIZED
        );

        let now = timestamp::now_seconds();
        let entry = ScheduleEntry {
            campaign_id,
            content_hash,
            platforms,
            schedule_type,
            scheduled_for,
            created_at: now,
            executed: false,
        };

        let schedule = borrow_global_mut<ScheduledContent>(vault_owner);
        vector::push_back(&mut schedule.entries, entry);

        event::emit(ContentScheduledEvent {
            campaign_id,
            schedule_type,
            scheduled_for,
            platforms,
            timestamp: now,
        });
    }

    /// Log agent activity — AGENT ONLY
    public entry fun log_agent_activity(
        agent: &signer,
        vault_owner: address,
        action_type: String,
        description: String,
        data_hash: vector<u8>,
    ) acquires BrandVault, AgentActivityLog {
        let agent_addr = signer::address_of(agent);
        let vault = borrow_global<BrandVault>(vault_owner);
        assert!(agent_addr == vault.agent_address, E_NOT_AUTHORIZED);

        let now = timestamp::now_seconds();
        let entry = ActivityEntry {
            action_type,
            description,
            data_hash,
            timestamp: now,
        };

        let log = borrow_global_mut<AgentActivityLog>(vault_owner);
        vector::push_back(&mut log.entries, entry);

        event::emit(AgentActivityEvent {
            agent: agent_addr,
            action_type,
            data_hash,
            timestamp: now,
        });
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================

    #[view]
    public fun get_encrypted_guidelines(vault_owner: address): vector<u8> acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).encrypted_guidelines
    }

    #[view]
    public fun get_brand_name(vault_owner: address): String acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).brand_name
    }

    #[view]
    public fun get_guidelines_hash(vault_owner: address): vector<u8> acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).guidelines_hash
    }

    #[view]
    public fun get_campaign_count(vault_owner: address): u64 acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).campaign_count
    }

    #[view]
    public fun get_agent_address(vault_owner: address): address acquires BrandVault {
        borrow_global<BrandVault>(vault_owner).agent_address
    }
}
