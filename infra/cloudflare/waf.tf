resource "cloudflare_ruleset" "contractconnect_custom_waf" {
  zone_id     = var.cloudflare_zone_id
  name        = "ContractConnect custom WAF"
  description = "Blocks requests for common secret and repository paths."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      ref         = "block_sensitive_paths"
      description = "Block access to environment, source-control, and backup files"
      expression  = <<-EOT
        lower(http.request.uri.path) in {"/.env" "/.env.local" "/.git/config" "/package-lock.json" "/terraform.tfstate"} or
        lower(http.request.uri.path) contains "/.git/" or
        ends_with(lower(http.request.uri.path), ".sql") or
        ends_with(lower(http.request.uri.path), ".bak")
      EOT
      action      = "block"
      enabled     = true
    }
  ]
}

resource "cloudflare_ruleset" "contractconnect_managed_waf" {
  zone_id     = var.cloudflare_zone_id
  name        = "ContractConnect managed WAF"
  description = "Cloudflare Managed and OWASP Core rules for ContractConnect."
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules = [
    {
      ref         = "execute_cloudflare_managed_ruleset"
      description = "Execute Cloudflare Managed Ruleset"
      expression  = "true"
      action      = "execute"
      enabled     = true
      action_parameters = {
        id = var.cloudflare_managed_ruleset_id
      }
    },
    {
      ref         = "execute_cloudflare_owasp_ruleset"
      description = "Execute Cloudflare OWASP Core Ruleset"
      expression  = "true"
      action      = "execute"
      enabled     = true
      action_parameters = {
        id = var.cloudflare_owasp_ruleset_id
        overrides = {
          categories = [
            { category = "paranoia-level-3", enabled = false },
            { category = "paranoia-level-4", enabled = false }
          ]
        }
      }
    }
  ]
}

