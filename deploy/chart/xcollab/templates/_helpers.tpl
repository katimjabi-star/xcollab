{{/* Chart name */}}
{{- define "xcollab.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Fully qualified base name */}}
{{- define "xcollab.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/* Common labels */}}
{{- define "xcollab.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "xcollab.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels shared by all chart pods. Also the podSelector of every
NetworkPolicy in this chart — policies must NEVER select namespace-wide
(empty podSelector): the tasdiq-* namespaces are shared with other
projects (x4auth, mahara, saf-recon, redis) and a namespace-wide
default-deny would cut off their traffic.
*/}}
{{- define "xcollab.selectorLabels" -}}
app.kubernetes.io/name: {{ include "xcollab.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: xcollab
{{- end -}}

{{/*
PSA "restricted"-compliant pod securityContext. uid 10001 matches the
useradd in deploy/docker/*.Dockerfile.
*/}}
{{- define "xcollab.podSecurityContext" -}}
runAsNonRoot: true
runAsUser: 10001
runAsGroup: 10001
fsGroup: 10001
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{/* PSA "restricted"-compliant container securityContext */}}
{{- define "xcollab.containerSecurityContext" -}}
runAsNonRoot: true
runAsUser: 10001
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop:
    - ALL
{{- end -}}
