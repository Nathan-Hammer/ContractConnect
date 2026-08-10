variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID containing the ContractConnect hostname."
  type        = string
  sensitive   = true
}

variable "cloudflare_managed_ruleset_id" {
  description = "Cloudflare Managed Ruleset ID for the selected zone/plan."
  type        = string
  default     = "efb7b8c949ac4650a09736fc376e9aee"
}

variable "cloudflare_owasp_ruleset_id" {
  description = "Cloudflare OWASP Core Ruleset ID for the selected zone/plan."
  type        = string
  default     = "4814384a9e5d4991b9815dcfc25d2f1f"
}

