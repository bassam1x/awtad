# نشر الواجهة على S3 + CloudFront.
# الاستخدام:
#   .\infra\deploy-web.ps1 -StackName mahara-web -BucketName my-unique-bucket -ApiUrl https://api.example.com -Region eu-central-1
param(
  [Parameter(Mandatory)] [string] $StackName,
  [Parameter(Mandatory)] [string] $BucketName,
  [Parameter(Mandatory)] [string] $ApiUrl,
  [string] $Region = 'eu-central-1'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

aws cloudformation deploy --region $Region --stack-name $StackName --template-file "$PSScriptRoot\web-stack.yaml" --parameter-overrides BucketName=$BucketName
function Out($k) { aws cloudformation describe-stacks --region $Region --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='$k'].OutputValue" --output text }
$dist = Out 'DistributionId'; $url = Out 'Url'

$env:VITE_API_URL = $ApiUrl
npm --prefix $root run build

# الملفات المُجزّأة بالـ hash تُخزَّن طويلاً، وindex.html لا يُخزَّن
aws s3 sync "$root\apps\web\dist" "s3://$BucketName" --delete --exclude index.html --cache-control 'public,max-age=31536000,immutable'
aws s3 cp "$root\apps\web\dist\index.html" "s3://$BucketName/index.html" --cache-control 'no-cache'
aws cloudfront create-invalidation --distribution-id $dist --paths '/index.html' | Out-Null

Write-Host "تم النشر: $url"
Write-Host "أضف هذا العنوان إلى CORS_ORIGINS في الخادم: $url"
