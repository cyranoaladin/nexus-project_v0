'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertTriangle, CheckCircle, CreditCard, Mail, Settings, XCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface ConfigStatus {
  variable: string;
  configured: boolean;
  value: string;
}

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

export default function AdminTestsPage() {
  const { data: session } = useSession();
  const [emailConfig, setEmailConfig] = useState<ConfigStatus[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testAmount, setTestAmount] = useState('1000');
  const [results, setResults] = useState<{ [key: string]: TestResult; }>({});

  // Vérifier l'autorisation (éviter hook conditionnel)
  const isAuthorized = !!(session?.user && ['ADMIN', 'ASSISTANTE'].includes(session.user.role));

  // Charger les configurations au démarrage
  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      // Charger config email
      const emailResponse = await fetch('/api/admin/test-email');
      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        setEmailConfig(emailData.configuration);
      }

      // Charger config paiements
      const paymentResponse = await fetch('/api/admin/test-payments');
      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        setPaymentConfig(paymentData.configuration);
      }
    } catch (error) {
      console.error('Erreur chargement configurations:', error);
    }
  };

  const runTest = async (testType: string, endpoint: string, data: any = {}) => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      setResults(prev => ({ ...prev, [testType]: result }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [testType]: {
          success: false,
          error: error.message
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const TestResultDisplay = ({ testKey, title }: { testKey: string, title: string; }) => {
    const result = results[testKey];
    if (!result) return null;

    return (
      <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <div className="flex items-start gap-2">
          {result.success ?
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" /> :
            <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
          }
          <div className="flex-1">
            <p className="font-semibold text-sm">{title}</p>
            <AlertDescription className="mt-1">
              {result.success ? result.message : result.error}
              {result.data && (
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-20">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {!isAuthorized && (
        <div className="container mx-auto p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Accès non autorisé. Seuls les administrateurs et assistantes peuvent accéder à cette page.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {isAuthorized && (
        <>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">Tests Système</h1>
              <p className="text-gray-600">Vérification et test des configurations critiques</p>
            </div>
          </div>

          {/* Configuration Email */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Configuration Email (SMTP)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {emailConfig.map((config) => (
                  <div key={config.variable} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{config.variable}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={config.configured ? 'default' : 'destructive'}>
                        {config.configured ? 'Configuré' : 'Manquant'}
                      </Badge>
                      <span className="text-sm text-gray-600 max-w-32 truncate">
                        {config.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => runTest('emailConfig', '/api/admin/test-email', { action: 'test_config' })}
                  disabled={loading}
                  className="w-full"
                >
                  Tester la Configuration SMTP
                </Button>

                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@test.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => runTest('emailSend', '/api/admin/test-email', {
                      action: 'send_test',
                      testEmail
                    })}
                    disabled={loading || !testEmail}
                    variant="outline"
                  >
                    Envoyer Test
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <TestResultDisplay testKey="emailConfig" title="Test Configuration SMTP" />
                <TestResultDisplay testKey="emailSend" title="Test Envoi Email" />
              </div>
            </CardContent>
          </Card>

          {/* Configuration Paiements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Configuration Paiements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentConfig && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Konnect (Tunisie)</h4>
                    {Object.entries(paymentConfig.konnect).map(([key, configured]) => (
                      <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{key}</span>
                        <Badge variant={configured ? 'default' : 'destructive'}>
                          {configured ? 'OK' : 'Manquant'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={() => runTest('konnectConnection', '/api/admin/test-payments', {
                    action: 'test_connection'
                  })}
                  disabled={loading}
                  className="w-full"
                >
                  Tester Connexion Konnect
                </Button>

                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Montant (millimes)"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    min="100"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => runTest('konnectPayment', '/api/admin/test-payments', {
                      action: 'create_test_payment',
                      amount: parseInt(testAmount)
                    })}
                    disabled={loading || !testAmount}
                    variant="outline"
                  >
                    Créer Paiement Test
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <TestResultDisplay testKey="konnectConnection" title="Test Connexion Konnect" />
                <TestResultDisplay testKey="konnectPayment" title="Test Création Paiement" />
              </div>
            </CardContent>
          </Card>

          {/* Résumé des Tests */}
          <Card>
            <CardHeader>
              <CardTitle>Résumé des Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="font-semibold text-green-800">Tests Réussis</p>
                  <p className="text-2xl font-bold text-green-600">
                    {Object.values(results).filter(r => r.success).length}
                  </p>
                </div>

                <div className="text-center p-4 bg-red-50 rounded-lg border-2 border-red-200">
                  <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <p className="font-semibold text-red-800">Tests Échoués</p>
                  <p className="text-2xl font-bold text-red-600">
                    {Object.values(results).filter(r => !r.success).length}
                  </p>
                </div>

                <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <Settings className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="font-semibold text-blue-800">Total Tests</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {Object.keys(results).length}
                  </p>
                </div>
              </div>

              {Object.keys(results).length > 0 && (
                <div className="mt-6">
                  <Button
                    onClick={() => setResults({})}
                    variant="outline"
                    className="w-full"
                  >
                    Effacer les Résultats
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
